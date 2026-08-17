// Accounts and sessions. No game logic lives here.
//
// No passwords, on purpose: less code, and no password breach to own. Two ways
// in, behind the same two endpoints, so swapping one for the other later does
// not touch anything downstream.
//
//   dev    a name and nothing else, for building against. DEV_LOGIN must be
//          off in production or every account is free to take.
//   email  a magic link. Live as soon as RESEND_API_KEY is set and the
//          domain is verified; until then requesting a link returns the token
//          in the response so it is testable.

import { one, run, now, uuid, newToken, hashToken } from "./db.js";

const HOUR = 3600e3, DAY = 24 * HOUR;
const LINK_TTL    = 15 * 60e3;   // a login link is short lived by design
const SESSION_TTL = 30 * DAY;

const pepper = env => env.TOKEN_PEPPER || "dev-pepper";

const findOrCreate = async (env, { provider, providerId, email }) => {
  const found = await one(env.DB,
    "SELECT * FROM accounts WHERE provider = ? AND provider_id = ?", provider, providerId);
  if (found) return found;
  const id = uuid();
  await run(env.DB,
    `INSERT INTO accounts (id, provider, provider_id, email, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    id, provider, providerId, email || null, now());
  return one(env.DB, "SELECT * FROM accounts WHERE id = ?", id);
};

const startSession = async (env, accountId) => {
  const token = newToken();
  const at = now();
  await run(env.DB,
    `INSERT INTO sessions (hash, account_id, created_at, expires_at, last_seen)
     VALUES (?, ?, ?, ?, ?)`,
    await hashToken(token, pepper(env)), accountId, at, at + SESSION_TTL, at);
  return { token, expiresAt: at + SESSION_TTL };
};

// Reads the bearer token off a request and returns the account, or null.
// Every endpoint but /auth/* and /config goes through this.
export const authenticate = async (env, req) => {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const row = await one(env.DB,
    "SELECT * FROM sessions WHERE hash = ?", await hashToken(token, pepper(env)));
  if (!row || row.expires_at < now()) return null;
  const account = await one(env.DB, "SELECT * FROM accounts WHERE id = ?", row.account_id);
  if (!account || account.banned) return null;
  // Cheap, and it makes "who is actually playing" answerable later.
  await run(env.DB, "UPDATE sessions SET last_seen = ? WHERE hash = ?", now(), row.hash);
  return account;
};

// POST /auth/link  { email }  — or { name } when DEV_LOGIN is on.
export const requestLink = async (env, body) => {
  if (env.DEV_LOGIN === "true" && body.name) {
    const account = await findOrCreate(env,
      { provider: "dev", providerId: String(body.name).slice(0, 24) });
    const session = await startSession(env, account.id);
    return { ok: true, dev: true, ...session };
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "bad_email" };

  const token = newToken();
  await run(env.DB,
    `INSERT INTO login_tokens (hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)`,
    await hashToken(token, pepper(env)), email, now(), now() + LINK_TTL);

  if (!env.RESEND_API_KEY) return { ok: true, sent: false, token };   // dev: no mail service yet
  await sendMail(env, email, token);
  return { ok: true, sent: true };
};

// POST /auth/verify  { token }  → a session token.
export const verifyLink = async (env, body) => {
  const hash = await hashToken(String(body.token || ""), pepper(env));
  const row = await one(env.DB, "SELECT * FROM login_tokens WHERE hash = ?", hash);
  if (!row || row.used_at || row.expires_at < now()) return { ok: false, error: "bad_token" };
  await run(env.DB, "UPDATE login_tokens SET used_at = ? WHERE hash = ?", now(), hash);

  const account = await findOrCreate(env,
    { provider: "email", providerId: row.email, email: row.email });
  return { ok: true, ...(await startSession(env, account.id)) };
};

const sendMail = async (env, email, token) => {
  const link = `${env.GAME_URL || "https://example.com"}/#login=${token}`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.MAIL_FROM || "login@example.com",
      to: email,
      subject: "Your fishing login link",
      text: `Tap to sign in:\n\n${link}\n\nThe link works once and expires in 15 minutes.`,
    }),
  });
};

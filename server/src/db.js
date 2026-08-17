// Thin helpers over D1. Nothing clever — the queries are all small and the
// interesting logic belongs in the files that call these.

export const now = () => Date.now();

export const uuid = () => crypto.randomUUID();

// Tokens are random, sent to the client once, and only ever stored hashed.
// The pepper means a stolen database is not a pile of usable tokens.
export const newToken = () => {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, "0")).join("");
};

export const hashToken = async (token, pepper) => {
  const data = new TextEncoder().encode(`${pepper}:${token}`);
  const out = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(out)].map(x => x.toString(16).padStart(2, "0")).join("");
};

export const one = async (db, sql, ...args) =>
  db.prepare(sql).bind(...args).first();

export const run = async (db, sql, ...args) =>
  db.prepare(sql).bind(...args).run();

export const all = async (db, sql, ...args) =>
  (await db.prepare(sql).bind(...args).all()).results;

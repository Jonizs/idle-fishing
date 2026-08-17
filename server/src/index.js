// The API. Five endpoints, and POST /action is the game.
//
//   POST /auth/link      request a login link
//   POST /auth/verify    exchange it for a session token
//   GET  /state          the server's copy of your save
//   POST /action         one intent, with an idempotency key
//   GET  /config         what is currently active
//
// Note what is absent: there is no endpoint that takes a number from the
// client and believes it.

import { authenticate, requestLink, verifyLink } from "./auth.js";
import { applyAction } from "./action.js";
import { config, world } from "./config.js";
import { now } from "./db.js";

const cors = (env, req) => {
  const origin = req.headers.get("origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim());
  const h = {
    "content-type": "application/json",
    vary: "origin",
  };
  if (allowed.includes(origin)) {
    h["access-control-allow-origin"] = origin;
    h["access-control-allow-headers"] = "authorization, content-type";
    h["access-control-allow-methods"] = "GET, POST, OPTIONS";
    h["access-control-max-age"] = "86400";
  }
  return h;
};

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), { status, headers });

export default {
  async fetch(req, env) {
    const headers = cors(env, req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (path === "/")         return json({ ok: true, service: "idle-fishing-api" }, 200, headers);
      if (path === "/config")   return json(await config(env), 200, headers);

      if (path === "/auth/link" && req.method === "POST")
        return json(await requestLink(env, await req.json()), 200, headers);
      if (path === "/auth/verify" && req.method === "POST")
        return json(await verifyLink(env, await req.json()), 200, headers);

      // Everything past here needs a session.
      const account = await authenticate(env, req);
      if (!account) return json({ error: "unauthorised" }, 401, headers);

      if (path === "/state") {
        // Reading the save is also a chance to bank the elapsed time, so a
        // player who opens the game after a day away sees it straight away.
        const w = await world(env);
        const result = await applyAction(env, account,
          { id: crypto.randomUUID(), type: "tick" }, w);
        return json({ account: { id: account.id, name: account.name },
                      ...result.body, world: w, serverTime: now() },
                    result.status, headers);
      }

      if (path === "/action" && req.method === "POST") {
        const result = await applyAction(env, account, await req.json(), await world(env));
        return json(result.body, result.status, headers);
      }

      return json({ error: "not_found" }, 404, headers);
    } catch (err) {
      // The message stays server-side; the client gets a code it can show.
      console.error(err?.stack || String(err));
      return json({ error: "server_error" }, 500, headers);
    }
  },
};

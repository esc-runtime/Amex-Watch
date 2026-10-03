/**
 * Send feedback — open to guests and signed-in users alike.
 *
 *   POST /.netlify/functions/feedback   { "body": "..." }
 *
 * The browser can't write to the feedback table any more; this is the only
 * way in. The limits themselves live in the submit_feedback() database
 * function (see sql/2026-10-04-feedback-limits.sql), so they hold even if
 * someone skips this endpoint.
 *
 * Guests are counted by IP, but only a scrambled (HMAC) version is stored —
 * enough to tell two messages came from the same place, useless for finding
 * out where that is.
 */

import { createHmac } from "node:crypto";
import { getServiceClient } from "../lib/supabase.js";

/** Must match MAX_LENGTH in src/Feedback.jsx and the limit in the SQL. */
const MAX_LENGTH = 1000;

const MESSAGES = {
  empty: "Write something first.",
  too_long: `Please keep it under ${MAX_LENGTH} characters.`,
  person_limit:
    "You've sent quite a few messages today, thank you! Please send more tomorrow.",
  daily_limit:
    "We've received a lot of feedback today, thank you! Please share yours tomorrow. We'd really like to hear it.",
  failed: "Could not send your message right now. Please try again in a bit.",
};

function reply(status, code) {
  return Response.json(
    { ok: code === "ok", code, message: MESSAGES[code] || null },
    { status }
  );
}

function hashIp(ip) {
  if (!ip) return null;
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY)
    .update(ip)
    .digest("hex");
}

/** A signed-in user sends their session token; a guest sends nothing. */
async function userIdFrom(req, db) {
  const header = req.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;

  const { data, error } = await db.auth.getUser(header.slice(7));
  if (error) return null;
  return data?.user?.id ?? null;
}

export default async (req, context) => {
  if (req.method !== "POST") return reply(405, "failed");

  let payload;
  try {
    payload = await req.json();
  } catch {
    return reply(400, "empty");
  }

  const text = typeof payload?.body === "string" ? payload.body.trim() : "";

  if (!text) return reply(400, "empty");
  if (text.length > MAX_LENGTH) return reply(400, "too_long");

  const db = getServiceClient();
  const userId = await userIdFrom(req, db);
  const ip =
    context?.ip || req.headers.get("x-nf-client-connection-ip") || null;

  const { data: result, error } = await db.rpc("submit_feedback", {
    p_body: text,
    p_user_id: userId,
    p_ip_hash: userId ? null : hashIp(ip),
  });

  if (error) {
    console.error("[feedback]", error.message);
    return reply(500, "failed");
  }

  if (result === "ok") return reply(200, "ok");
  if (result === "person_limit" || result === "daily_limit") {
    return reply(429, result);
  }
  return reply(400, result in MESSAGES ? result : "failed");
};

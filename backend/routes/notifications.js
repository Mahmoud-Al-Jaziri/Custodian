import { Router } from "express";
import webpush from "web-push";
import pool from "../db.js";
import { verifyToken } from "../middleware/auth.js";
import { hasCronSecret } from "../middleware/cronSecret.js";
import { isDue } from "../lib/reminderSchedule.js";

const notificationsRouter = Router();

// VAPID identifies this server to browser push services. Missing keys mean
// push is unconfigured — subscribe/dispatch answer 503 instead of crashing
// the whole API at import time.
const vapidConfigured = Boolean(
  process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
);
if (vapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:mahmoudaljaziri77@gmail.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const MAX_ENDPOINT = 1000;
const MAX_KEY = 300;

function isValidTimezone(tz) {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// The user's current local calendar date and hour in their IANA timezone.
// All reminder scheduling happens in the user's local time — same principle
// as relay_date everywhere else in the app.
function localParts(timezone, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
  };
}

// SUBSCRIBE / UPDATE — store this device's push subscription plus the user's
// reminder hour and timezone. Upserts on endpoint, so changing the hour is
// the same call. Signed-in users only: identity comes from the verified
// token, and dispatch needs it to skip users who already wrote tonight.
notificationsRouter.post("/subscribe", verifyToken, async (req, res) => {
  if (!vapidConfigured) {
    return res.status(503).json({ error: "Push is not configured" });
  }

  const { subscription, timezone, remindHour } = req.body;
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const authKey = subscription?.keys?.auth;

  if (
    typeof endpoint !== "string" ||
    !endpoint.startsWith("https://") ||
    endpoint.length > MAX_ENDPOINT ||
    typeof p256dh !== "string" || p256dh.length > MAX_KEY ||
    typeof authKey !== "string" || authKey.length > MAX_KEY
  ) {
    return res.status(400).json({ error: "Invalid push subscription" });
  }

  const hour =
    Number.isInteger(remindHour) && remindHour >= 0 && remindHour <= 23
      ? remindHour
      : 21;
  const tz = isValidTimezone(timezone) ? timezone : "UTC";
  const userId = req.user.uid;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // FK target, same self-sufficiency as POST /handoffs.
    await client.query(
      `INSERT INTO users (id, display_name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [userId, req.user.email || null]
    );

    const result = await client.query(
      `INSERT INTO push_subscriptions
         (user_id, endpoint, p256dh, auth, timezone, remind_hour)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (endpoint) DO UPDATE SET
         user_id = $1,
         p256dh = $3,
         auth = $4,
         timezone = $5,
         remind_hour = $6
       RETURNING remind_hour, timezone`,
      [userId, endpoint, p256dh, authKey, tz, hour]
    );

    await client.query("COMMIT");
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err; // → central error handler
  } finally {
    client.release();
  }
});

// UNSUBSCRIBE — remove this device's subscription. Scoped to the caller.
notificationsRouter.delete("/subscribe", verifyToken, async (req, res) => {
  const { endpoint } = req.body;
  if (typeof endpoint !== "string") {
    return res.status(400).json({ error: "endpoint is required" });
  }
  await pool.query(
    `DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2`,
    [endpoint, req.user.uid]
  );
  res.status(200).json({ message: "Unsubscribed" });
});

// SETTINGS — the stored reminder settings for this device, or null.
notificationsRouter.get("/settings", verifyToken, async (req, res) => {
  const { endpoint } = req.query;
  if (typeof endpoint !== "string") {
    return res.status(400).json({ error: "endpoint is required" });
  }
  const result = await pool.query(
    `SELECT remind_hour, timezone FROM push_subscriptions
     WHERE endpoint = $1 AND user_id = $2`,
    [endpoint, req.user.uid]
  );
  res.status(200).json(result.rows[0] || null);
});

// DISPATCH — called hourly by the scheduler (GitHub Actions), not by users.
// Guarded by a shared secret header instead of verifyToken. For every stored
// subscription: if the user's local hour matches their chosen reminder hour
// (with a one-hour grace window for scheduler lag), they haven't been
// reminded today, and they haven't already written tonight's handoff, send.
notificationsRouter.post("/dispatch", async (req, res) => {
  if (!hasCronSecret(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!vapidConfigured) {
    return res.status(503).json({ error: "Push is not configured" });
  }

  // The ::text cast is load-bearing. node-pg parses a DATE column into a JS
  // Date, so String(thatDate).slice(0, 10) yielded "Wed Aug 26" — never equal
  // to the "2026-08-26" it was compared against. The already-reminded-today
  // check silently always failed, so the grace hour always fired a SECOND
  // notification. The handoffs query below casts for exactly this reason.
  const { rows: subs } = await pool.query(
    `SELECT *, last_sent_date::text AS last_sent_date_text
     FROM push_subscriptions`
  );

  const due = [];
  for (const s of subs) {
    const { date, hour } = localParts(s.timezone);
    // isDue throws if lastSentDate isn't a string or null, so the bug above
    // can only ever come back loudly. See lib/reminderSchedule.js.
    const dueNow = isDue({
      remindHour: s.remind_hour,
      lastSentDate: s.last_sent_date_text,
      localDate: date,
      localHour: hour,
    });
    if (dueNow) due.push({ ...s, localDate: date });
  }

  if (due.length === 0) {
    return res
      .status(200)
      .json({ checked: subs.length, sent: 0, alreadyWrote: 0, pruned: 0 });
  }

  // Don't nag anyone who already passed tonight's baton.
  const userIds = [...new Set(due.map((d) => d.user_id))];
  const dates = [...new Set(due.map((d) => d.localDate))];
  const { rows: written } = await pool.query(
    `SELECT user_id, relay_date::text AS d
     FROM handoffs
     WHERE user_id = ANY($1) AND relay_date = ANY($2::date[])`,
    [userIds, dates]
  );
  const wroteTonight = new Set(
    written.map((w) => `${w.user_id}|${w.d.slice(0, 10)}`)
  );

  const payload = JSON.stringify({
    title: "Custodian",
    body: "Tomorrow-you is waiting. Leave the handoff before you sleep.",
    url: "/#/evening",
  });

  const sentRows = [];
  const pruneIds = [];
  let alreadyWrote = 0;

  await Promise.allSettled(
    due.map(async (s) => {
      if (wroteTonight.has(`${s.user_id}|${s.localDate}`)) {
        alreadyWrote += 1;
        return;
      }
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 6 * 3600 } // stale reminders shouldn't arrive at 3am
        );
        sentRows.push(s);
      } catch (err) {
        // 404/410 mean the browser revoked the subscription — clean it up.
        if (err.statusCode === 404 || err.statusCode === 410) {
          pruneIds.push(s.id);
        } else {
          console.error("Push send failed:", err.statusCode, err.message);
        }
      }
    })
  );

  if (sentRows.length > 0) {
    await pool.query(
      `UPDATE push_subscriptions AS p
       SET last_sent_date = v.d::date
       FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS d) v
       WHERE p.id = v.id`,
      [sentRows.map((s) => s.id), sentRows.map((s) => s.localDate)]
    );
  }
  if (pruneIds.length > 0) {
    await pool.query(
      `DELETE FROM push_subscriptions WHERE id = ANY($1::uuid[])`,
      [pruneIds]
    );
  }

  res.status(200).json({
    checked: subs.length,
    sent: sentRows.length,
    alreadyWrote,
    pruned: pruneIds.length,
  });
});

export default notificationsRouter;

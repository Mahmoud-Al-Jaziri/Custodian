import { Router } from "express";
import pool from "../db.js";

const handoffsRouter = Router();

// A handoff id is a UUID. Anything not shaped like one can't match a real
// row, so we return 404 up front instead of letting Postgres throw
// "invalid input syntax for type uuid" (which would surface as a 500).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);

// SECURITY MODEL
// --------------
// Every route in this file is mounted behind verifyToken (see index.js), which
// sets req.user from the verified Firebase ID token. The user's identity is
// ALWAYS taken from req.user.uid — never from the URL, never from the body.
// A client can therefore only ever touch its own rows, no matter what it sends.
//
// Errors: routes throw (or reject) and the central handler in index.js logs
// the real error and returns a generic message — raw Postgres errors leak
// schema details, so they never reach the client.

// INPUT VALIDATION
// ----------------
// Server-side limits mirror the client's (MAX_CHARS = 2000 in Evening.jsx)
// so the UI can't drift into sending payloads the API rejects.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTE = 2000;
const MAX_ONE_THING = 500;
const MAX_URL = 2048;
// Attachments only ever live in our Firebase Storage bucket; anything else
// stored in image_url would be rendered by the client later.
const STORAGE_URL_PREFIX = "https://firebasestorage.googleapis.com/";

function handoffRowError(row, { allowEmptyNote = false } = {}) {
  const { note, one_thing, relay_date, image_url } = row || {};
  if (typeof note !== "string" || note.length > MAX_NOTE) {
    return `note must be a string of at most ${MAX_NOTE} characters`;
  }
  if (!allowEmptyNote && note.trim().length === 0) {
    return "note is required";
  }
  if (
    one_thing != null &&
    (typeof one_thing !== "string" || one_thing.length > MAX_ONE_THING)
  ) {
    return `one_thing must be a string of at most ${MAX_ONE_THING} characters`;
  }
  if (typeof relay_date !== "string" || !DATE_RE.test(relay_date)) {
    return "relay_date must be a YYYY-MM-DD date";
  }
  if (
    image_url != null &&
    (typeof image_url !== "string" ||
      image_url.length > MAX_URL ||
      !image_url.startsWith(STORAGE_URL_PREFIX))
  ) {
    return "image_url must be a Firebase Storage URL";
  }
  return null;
}

// CREATE / UPSERT — save tonight's handoff for the authenticated user.
handoffsRouter.post("/", async (req, res) => {
  const userId = req.user.uid;
  const { note, one_thing, relay_date, image_url } = req.body;

  const invalid = handoffRowError({ note, one_thing, relay_date, image_url });
  if (invalid) return res.status(400).json({ error: invalid });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Make sure the FK target exists. Normally /bulk created it at first
    // sign-in, but this keeps POST self-sufficient (idempotent upsert).
    await client.query(
      `INSERT INTO users (id, display_name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [userId, req.user.email || null]
    );

    // On edit (the ON CONFLICT path) a missing image_url means "leave the
    // existing attachment alone" — COALESCE keeps the stored one rather than
    // nulling it. Sending a new url still replaces it.
    const result = await client.query(
      `INSERT INTO handoffs (user_id, note, one_thing, relay_date, image_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, relay_date)
       DO UPDATE SET
         note = $2,
         one_thing = $3,
         image_url = COALESCE($5, handoffs.image_url)
       RETURNING *`,
      [userId, note, one_thing, relay_date, image_url]
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

// BULK CREATE — migrate guest handoffs into the cloud after first sign-in.
// Also upserts the users row so the FK constraint is satisfied in the same
// txn. One multi-row INSERT instead of N round-trips, so even a long-time
// guest migrates within a serverless invocation's time budget.
const MAX_BULK_ROWS = 500;

handoffsRouter.post("/bulk", async (req, res) => {
  const { handoffs = [], display_name } = req.body;
  const userId = req.user.uid;

  if (!Array.isArray(handoffs) || handoffs.length > MAX_BULK_ROWS) {
    return res
      .status(400)
      .json({ error: `handoffs must be an array of at most ${MAX_BULK_ROWS}` });
  }
  for (const h of handoffs) {
    // Old guest rows are preserved even if somehow empty — don't fail a
    // migration over a blank note.
    const invalid = handoffRowError(
      { ...h, note: h?.note ?? "" },
      { allowEmptyNote: true }
    );
    if (invalid) {
      return res.status(400).json({ error: invalid });
    }
  }

  // Local storage keys by relay_date so duplicates shouldn't exist, but a
  // duplicate date in one multi-row upsert is a Postgres error ("cannot
  // affect row a second time") — dedupe defensively, last one wins.
  const byDate = new Map();
  for (const h of handoffs) byDate.set(h.relay_date, h);
  const rows = [...byDate.values()];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ensure the FK target exists. Idempotent.
    await client.query(
      `INSERT INTO users (id, display_name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE
         SET display_name = COALESCE(users.display_name, EXCLUDED.display_name)`,
      [userId, display_name || req.user.email || null]
    );

    let inserted = [];
    if (rows.length > 0) {
      // ($1 = user_id for every row; each row adds 4 params.)
      const params = [userId];
      const values = rows.map((h) => {
        const base = params.length;
        params.push(h.note ?? "", h.one_thing ?? null, h.relay_date, h.image_url ?? null);
        return `($1, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
      });

      const result = await client.query(
        `INSERT INTO handoffs (user_id, note, one_thing, relay_date, image_url)
         VALUES ${values.join(", ")}
         ON CONFLICT (user_id, relay_date)
         DO UPDATE SET
           note = EXCLUDED.note,
           one_thing = EXCLUDED.one_thing,
           image_url = COALESCE(EXCLUDED.image_url, handoffs.image_url)
         RETURNING *`,
        params
      );
      inserted = result.rows;
    }

    await client.query("COMMIT");
    res.status(201).json({ count: inserted.length, handoffs: inserted });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err; // → central error handler
  } finally {
    client.release();
  }
});

// READ ONE — today's handoff for the authenticated user.
// NOTE: static paths (/today, /latest) are declared before any param routes
// would be — Express matches in declaration order.
handoffsRouter.get("/today", async (req, res) => {
  const { today } = req.query;
  if (typeof today !== "string" || !DATE_RE.test(today)) {
    return res.status(400).json({ error: "today must be a YYYY-MM-DD date" });
  }

  const result = await pool.query(
    `SELECT *
     FROM handoffs
     WHERE user_id = $1
     AND relay_date = $2::date
     LIMIT 1`,
    [req.user.uid, today]
  );
  res.status(200).json(result.rows[0] || null);
});

// READ ONE — latest handoff for the authenticated user.
handoffsRouter.get("/latest", async (req, res) => {
  const result = await pool.query(
    `SELECT *
     FROM handoffs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [req.user.uid]
  );
  res.status(200).json(result.rows[0] || null);
});

// READ ALL — handoffs belonging to the authenticated user.
//   ?limit=N          cap the number of rows (newest first)
//   ?fields=summary   only id/relay_date/one_thing — enough for the streak,
//                     calendar, and "one thing" card at ~a tenth the payload
handoffsRouter.get("/", async (req, res) => {
  const columns =
    req.query.fields === "summary" ? "id, relay_date, one_thing" : "*";

  const rawLimit = Number.parseInt(req.query.limit, 10);
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0 && rawLimit <= 1000
      ? rawLimit
      : null;

  const result = await pool.query(
    `SELECT ${columns}
     FROM handoffs
     WHERE user_id = $1
     ORDER BY relay_date DESC
     ${limit ? "LIMIT $2" : ""}`,
    limit ? [req.user.uid, limit] : [req.user.uid]
  );
  res.status(200).json(result.rows);
});

// UPDATE — edit today's handoff. There is intentionally no PUT/:id route.
// Editing tonight's handoff goes through the POST upsert above (same
// (user_id, relay_date) row), which also handles attachments. Only today's
// handoff is editable by design — once tomorrow-you has received a past
// handoff it's sealed history.

// DELETE — remove a handoff, only if it belongs to the authenticated user.
handoffsRouter.delete("/:id", async (req, res) => {
  const { id } = req.params;

  // Malformed id can't match a real row — 404 before touching the DB.
  if (!isUuid(id)) {
    return res.status(404).json({ error: "Handoff not found" });
  }

  const result = await pool.query(
    `DELETE FROM handoffs
     WHERE id = $1
     AND user_id = $2
     RETURNING *`,
    [id, req.user.uid]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Handoff not found" });
  }

  res.status(200).json({ message: "Handoff deleted" });
});

export default handoffsRouter;

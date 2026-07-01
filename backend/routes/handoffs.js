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

// CREATE / UPSERT — save tonight's handoff for the authenticated user.
handoffsRouter.post("/", async (req, res) => {
  const userId = req.user.uid;
  const { note, one_thing, relay_date, image_url } = req.body;

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
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// BULK CREATE — migrate guest handoffs into the cloud after first sign-in.
// Also upserts the users row so the FK constraint is satisfied in the same txn.
handoffsRouter.post("/bulk", async (req, res) => {
  const { handoffs = [], display_name } = req.body;
  const userId = req.user.uid;

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

    const inserted = [];
    for (const h of handoffs) {
      const r = await client.query(
        `INSERT INTO handoffs (user_id, note, one_thing, relay_date, image_url)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, relay_date)
         DO UPDATE SET
           note = EXCLUDED.note,
           one_thing = EXCLUDED.one_thing,
           image_url = COALESCE(EXCLUDED.image_url, handoffs.image_url)
         RETURNING *`,
        [
          userId,
          h.note ?? "",
          h.one_thing ?? null,
          h.relay_date,
          h.image_url ?? null,
        ]
      );
      inserted.push(r.rows[0]);
    }

    await client.query("COMMIT");
    res.status(201).json({ count: inserted.length, handoffs: inserted });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// READ ONE — today's handoff for the authenticated user.
// NOTE: static paths (/today, /latest) are declared before any param routes
// would be — Express matches in declaration order.
handoffsRouter.get("/today", async (req, res) => {
  try {
    const { today } = req.query;

    const result = await pool.query(
      `SELECT *
       FROM handoffs
       WHERE user_id = $1
       AND relay_date = $2::date
       LIMIT 1`,
      [req.user.uid, today]
    );
    res.status(200).json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ ONE — latest handoff for the authenticated user.
handoffsRouter.get("/latest", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM handoffs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.uid]
    );
    res.status(200).json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ ALL — every handoff belonging to the authenticated user.
handoffsRouter.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM handoffs
       WHERE user_id = $1
       ORDER BY relay_date DESC`,
      [req.user.uid]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE — edit today's handoff. The `AND user_id = $4` clause is the
// ownership check.
//
// NOTE: there is intentionally no PUT/:id route. Editing tonight's handoff
// goes through the POST upsert above (same (user_id, relay_date) row), which
// also handles attachments. Only today's handoff is editable by design —
// once tomorrow-you has received a past handoff it's sealed history.

// DELETE — remove a handoff, only if it belongs to the authenticated user.
handoffsRouter.delete("/:id", async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default handoffsRouter;
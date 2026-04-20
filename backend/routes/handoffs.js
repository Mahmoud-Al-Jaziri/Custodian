import { Router } from "express";
import pool from "../db.js";

const handoffsRouter = Router();

// CREATE — save tonight's handoff
handoffsRouter.post("/", async (req, res) => {
  try {
    const { user_id, note, one_thing, relay_date, image_url } = req.body;

    // one relay per user per day; use ON CONFLICT for upsert
    const query = `
      INSERT INTO handoffs (user_id, note, one_thing, relay_date, image_url)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, relay_date)
      DO UPDATE SET note = $2, one_thing = $3, image_url = $5
      RETURNING *
    `;

    const result = await pool.query(query, [
      user_id,
      note,
      one_thing,
      relay_date,
      image_url
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ ALL — get all handoffs for a user
handoffsRouter.get("/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const query = `
      SELECT *
      FROM handoffs
      WHERE user_id = $1
      ORDER BY relay_date DESC
    `;

    const result = await pool.query(query, [user_id]);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//READ ONE - get today's handoff specifically
handoffsRouter.get("/:user_id/today", async (req, res) => {
  try {
    const { user_id } = req.params;
    const { today } = req.query;

    const query = `
      SELECT *
      FROM handoffs
      WHERE user_id = $1
      AND relay_date = $2::date
      LIMIT 1
    `;

    const result = await pool.query(query, [user_id, today]);

    res.status(200).json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ ONE — get latest handoff specifically
handoffsRouter.get("/:user_id/latest", async (req, res) => {
  try {
    const { user_id } = req.params;
    
    const query = `
      SELECT *
      FROM handoffs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [user_id]);
    res.status(200).json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE — edit today's handoff
handoffsRouter.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { note, one_thing, relay_date } = req.body;

    const query = `
      UPDATE handoffs
      SET note = $1, one_thing = $2
      WHERE id = $3
      AND relay_date = $4
      RETURNING *
    `;

    const result = await pool.query(query, [
      note,
      one_thing,
      id,
      relay_date
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Handoff not found or not editable" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE — remove a handoff
handoffsRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      DELETE FROM handoffs
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Handoff not found" });
    }

    res.status(200).json({ message: "Handoff deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default handoffsRouter;
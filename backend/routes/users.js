import pool from "../db.js";
import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";

const usersRouter = Router();

// This router is mounted at /api WITHOUT a global verifyToken (the weather
// passthrough shares that prefix), so the guard is applied per-route here.
//
// The user id comes from the verified Firebase token — never from the body.
// Previously this endpoint was unauthenticated and trusted a client-supplied
// id, which let anyone insert arbitrary rows into the users table.
//
// Note: the frontend doesn't currently call this (the /handoffs/bulk
// migration upserts the users row at first sign-in), but it's kept as a
// safe, authenticated way to ensure a users row exists.
usersRouter.post("/signup", verifyToken, async (req, res) => {
  try {
    const { display_name } = req.body;
    await pool.query(
      `INSERT INTO users (id, display_name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [req.user.uid, display_name || req.user.email || null]
    );
    res.status(201).json({ message: "user created" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default usersRouter;
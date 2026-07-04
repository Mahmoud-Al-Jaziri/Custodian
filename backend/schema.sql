-- Custodian database schema (Neon / Postgres).
-- Run in the Neon SQL editor when setting up a new environment.
-- This file is the source of truth; keep it in sync with any manual changes.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,               -- Firebase uid
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id),
  note TEXT NOT NULL,
  one_thing TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  relay_date DATE DEFAULT CURRENT_DATE,
  -- One handoff per user per local calendar day. The unique index this
  -- creates also serves every per-user query (user_id is the leading column).
  UNIQUE (user_id, relay_date)
);

-- Custodian database schema (Neon / Postgres).
-- Run in the Neon SQL editor when setting up a new environment.
-- This file is the source of truth; keep it in sync with any manual changes.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,               -- Firebase uid
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One row per device that opted into evening reminders. endpoint is the
-- push service URL the browser issued; it uniquely identifies the device.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  remind_hour INT NOT NULL DEFAULT 21 CHECK (remind_hour BETWEEN 0 AND 23),
  last_sent_date DATE,              -- user-local date of the last send (dedupe)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON push_subscriptions (user_id);

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

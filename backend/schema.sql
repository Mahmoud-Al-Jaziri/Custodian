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

-- Shared weather cache. The API instance's in-memory Map can't be the only
-- cache: serverless discards it on every cold start, so most requests would
-- reach OpenWeather for real and burn the 1000-calls/day free tier. This table
-- is shared by every instance and survives restarts.
--
-- cache_key is coarsely-rounded "lat,lon" (~11 km). Real users only ever
-- produce a handful of keys, but the weather endpoint is public, so the key
-- space is NOT bounded by where users live — anyone can seed rows with
-- arbitrary coordinates. Staleness is decided at read time; routes/weather.js
-- sweeps rows older than a week on a small fraction of cache misses to keep
-- the table from growing without limit.
CREATE TABLE IF NOT EXISTS weather_cache (
  cache_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

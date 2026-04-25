# Relay

A daily journaling app — but not in the way you're thinking.

Most journaling apps ask you to reflect on your day. Relay asks you to write to tomorrow's version of yourself. Every evening you leave a note. Every morning you wake up and read what yesterday-you left behind.

The idea came from a simple observation: you're not the same person every day. Motivation fails because you're relying on a version of yourself that no longer exists by the time you need it. Relay works around that — instead of motivation, it builds stewardship. Today-you takes care of tomorrow-you.

---

## What it does

**Evening** — You write a short note to tomorrow-you. What you finished, what you left behind, one thing you want tomorrow-you to do. You can attach an image. The app also shows tomorrow's weather so your note is grounded in reality.

**Morning** — You wake up and read what yesterday-you wrote. No prompts. No journaling questions. Just a letter from a version of you that no longer exists.

**Dashboard** — A relay score (not a streak), the one thing yesterday-you left you, and a Pomodoro timer if you want to actually do that thing.

---

## Tech stack

- React + Vite
- React Bootstrap
- Express.js
- Firebase Auth + Firebase Storage
- Neon (Postgres)
- OpenWeatherMap API
- Deployed on Vercel

---

## Running locally

Clone the repo and install dependencies:

```bash
git clone https://github.com/yourusername/relay-app.git
cd relay-app
npm install
```

Create a `.env` file in the root with:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Create a `.env` file in `backend/` with:

```
DB_URL=
OPENWEATHER_API_KEY=
PORT=3000
```

Start the backend:

```bash
cd backend
node index.js
```

Start the frontend:

```bash
npm run dev
```

---

## Database setup

Run these two queries in your Neon SQL editor:

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id),
  note TEXT NOT NULL,
  one_thing TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  relay_date DATE DEFAULT CURRENT_DATE,
  UNIQUE(user_id, relay_date)
);
```

---

## A few things worth knowing

The relay score is not a streak. Missing a day doesn't reset anything — it just lowers the percentage slightly. This was intentional. Streaks punish you for being human. A percentage just tells you where you are.

The "yesterday" query doesn't actually fetch yesterday's date. It fetches the most recent handoff before today. This handles the case where you write your note at 1am — technically that's today's date, but it should show up the next morning.

Firebase Storage rules are locked to authenticated users. You can only read and write your own files.

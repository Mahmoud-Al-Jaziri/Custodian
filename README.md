# Custodian

A daily journaling app — but not in the way you're thinking.

Most journaling apps ask you to reflect on your day. Custodian asks you to write to tomorrow's version of yourself. Every evening you leave a note. Every morning you wake up and read what yesterday-you left behind.

The idea came from a simple observation: you're not the same person every day. Motivation fails because you're relying on a version of yourself that no longer exists by the time you need it. Custodian works around that — instead of motivation, it builds stewardship. Today-you takes care of tomorrow-you.

---

## What it does

**Evening** — You write a short note to tomorrow-you. What you finished, what you left behind, one thing you want tomorrow-you to do. You can attach an image. The app also shows tomorrow's weather so your note is grounded in reality.

**Morning** — You wake up and read what yesterday-you wrote. No prompts. No journaling questions. Just a letter from a version of you that no longer exists.

**Dashboard** — A custodian score (not a streak), the one thing yesterday-you left you, and a Pomodoro timer if you want to actually do that thing.

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
git clone https://github.com/Mahmoud-Al-Jaziri/Custodian.git
cd Custodian
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
VITE_API_URL=http://localhost:3000/api
```

Create a `.env` file in `backend/` with:

```
# Use Neon's POOLED ("-pooler") connection string — the backend runs on
# serverless, and direct connections exhaust Postgres limits under load.
DB_URL=
OPENWEATHER_API_KEY=
PORT=3000
# JSON service account for verifying Firebase ID tokens
FIREBASE_SERVICE_ACCOUNT=
# Optional: extra allowed CORS origins, comma-separated (e.g. previews)
ALLOWED_ORIGINS=
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

Run [`backend/schema.sql`](backend/schema.sql) in your Neon SQL editor. That
file is the source of truth for the schema — keep it in sync with any manual
changes.

---

## Tests

```bash
npm test
```

Unit tests cover the night-streak logic (`src/utils/relayStreak.js`) — the
grace-night rules, refills, breaks, and date normalization.

---

## A few things worth knowing

The night streak is forgiving by design. You hold up to two "rest nights";
a missed night spends one instead of breaking the streak, and every seven
consecutive written nights earns one back. A broken run is never erased —
your best streak stays banked. Streaks that reset to zero punish you for
being human.

The "yesterday" query doesn't actually fetch yesterday's date. It fetches the
most recent handoff before today. This handles the case where you write your
note at 1am — technically that's today's date, but it should show up the next
morning.

Firebase Storage rules live in [`storage.rules`](storage.rules) (deploy with
`firebase deploy --only storage` or paste into the console): users can only
read and write their own files, uploads are capped at 10 MB, and only the
types the app's picker offers are accepted.

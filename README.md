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
# Web Push public key (npx web-push generate-vapid-keys)
VITE_VAPID_PUBLIC_KEY=
# App Check reCAPTCHA v3 site key (see "Abuse and cost control" below).
# Optional locally — the app runs without it.
VITE_RECAPTCHA_SITE_KEY=
# Sentry DSN (see "Error reporting" below). Optional — app runs without it.
VITE_SENTRY_DSN=
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
# Web Push (evening reminders) — npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
# Shared secret for the reminder scheduler (any long random string)
CRON_SECRET=
# Sentry DSN (see "Error reporting" below). Optional — app runs without it.
SENTRY_DSN=
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

## Evening reminders (Web Push)

Signed-in users can opt into a nightly push ("Tomorrow-you is waiting…") from
the Dashboard. How it fits together:

- The custom service worker (`src/sw.js`) shows the notification and opens
  the Evening page on tap.
- `POST /api/notifications/subscribe` stores the device's push subscription
  with the user's timezone and chosen hour (`push_subscriptions` table).
- A GitHub Actions cron (`.github/workflows/reminders.yml`) hits
  `POST /api/notifications/dispatch` hourly with the `CRON_SECRET` header.
  The backend sends to everyone whose local hour matches their chosen hour —
  and skips anyone who already wrote tonight's handoff.

Setup: generate VAPID keys (`npx web-push generate-vapid-keys`), set the env
vars above (backend + `VITE_VAPID_PUBLIC_KEY` on the frontend), run the
`push_subscriptions` part of `backend/schema.sql` in Neon, and add
`CRON_SECRET` as a GitHub Actions repo secret.

iOS note: reminders require the app installed to the home screen (iOS 16.4+).
The service worker only runs in production builds, so test with
`npm run build && npm run preview`, not `npm run dev`.

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

---

## Abuse and cost control

Attachments are the only part of this app that can generate an open-ended
bill — everything else is Neon, Vercel, and Firebase Auth (free to 50k monthly
active users). Two layers keep the Storage bucket bounded.

**1. Rules** — [`storage.rules`](storage.rules), deployed with
`firebase deploy --only storage` (or pasted into the console). Users can only
read and write their own folder, uploads are capped at 10 MB, only the types
the picker offers are accepted, and the filename must be
`<YYYY-MM-DD>.<ext>`. That last one is the cost control: without it the rules
allow unlimited distinct filenames per user, so one signed-in account could
loop 10 MB uploads forever.

**2. App Check** — proves a request came from this app rather than a script
holding the (public, bundled) Firebase config. Setup:

1. Firebase console → App Check → register the web app with **reCAPTCHA v3**.
2. Put the site key in `VITE_RECAPTCHA_SITE_KEY` (locally and in Vercel's env
   vars), then deploy.
3. Set Cloud Storage to **Enforced**. Nothing protects the bucket until this
   is on — registering the key and shipping the client code only makes
   attested requests *possible*, it doesn't reject unattested ones.
4. With an existing user base, do step 3 the slow way instead: watch App
   Check → Metrics for a few days until verified requests plateau, then
   enforce. Enforcing early locks out anyone still on a cached bundle —
   which for a PWA means until they accept the refresh banner.

Locally there's no attestation, so in dev the SDK prints a debug token to the
browser console — register it under App Check → Apps → Manage debug tokens.
The app runs fine without any of this configured; App Check simply stays off.

**3. A budget alert**, which is not code: GCP console → Billing → Budgets &
alerts. Blaze has no hard spending cap, so this is the only thing that tells
you an attack is in progress before the invoice does.

---

## Error reporting

Sentry, on both ends, so production failures surface without a user having to
report them. Entirely optional: with no DSN set, the SDK never initialises and
the app behaves exactly as before.

Setup: create a project at sentry.io (platform: React), then set
`VITE_SENTRY_DSN` in the root `.env` **and** in Vercel's env vars for the
frontend project, and `SENTRY_DSN` in `backend/.env` and the backend project.
Vite inlines env vars at build time, so a DSN added after a deploy needs a
redeploy to take effect.

What's deliberate about the setup:

- **No PII, no tracing, no Session Replay.** This app holds people's private
  reflections. Replay would literally record someone typing tonight's note.
- **Query strings are stripped** from reported URLs and breadcrumbs. Not
  theoretical — `/api/weather?lat=..&lon=..` is the user's precise location,
  and it would otherwise ride along on unrelated error reports.
- **CORS rejections aren't reported.** A blocked origin is routine noise, not
  a bug, and it would bury real errors.
- The backend does **not** use Sentry's `--import` auto-instrumentation, which
  needs control of the node invocation that Vercel's serverless runtime
  doesn't give us. Tracing and rich request context are the cost; every error
  reaching the central handler is still reported.

The frontend also has an error boundary ([`src/components/ErrorFallback.jsx`](src/components/ErrorFallback.jsx))
around the whole tree, so a render crash shows a "reload" screen instead of
a white page. That works with or without a DSN.

### Checking it still works

Reporting fails silently by design — you only notice it's broken at the exact
moment you need it. Both ends can be smoke-tested on demand.

**Frontend** — in the browser console on the deployed site:

```js
setTimeout(() => { throw new Error("sentry smoke test"); });
```

The `setTimeout` matters: it makes the throw asynchronous so it reaches
`window.onerror`, which is the handler Sentry hooks. Throwing directly in the
console gets caught by devtools instead.

**Backend** — `GET /api/debug/error` raises a deliberate 500. It's gated behind
the same `x-cron-secret` header the reminder dispatch uses, and answers 404
(not 401) without it, so it neither advertises itself nor gives anyone a way to
run up the Sentry error quota:

```bash
curl -H "x-cron-secret: $CRON_SECRET" https://<backend>/api/debug/error
```

Both should appear in Sentry within a minute, tagged with the environment they
came from.

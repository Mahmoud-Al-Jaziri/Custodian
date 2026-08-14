import * as Sentry from "@sentry/node";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import usersRouter from "./routes/users.js";
import handoffsRouter from "./routes/handoffs.js";
import weatherRouter from "./routes/weather.js";
import notificationsRouter from "./routes/notifications.js";
import { verifyToken } from "./middleware/auth.js";

// Error reporting. Guarded on the DSN so local dev and any environment without
// the secret runs unchanged; Sentry's calls are no-ops until init() runs.
//
// Deliberately NOT using the --import/instrument.mjs auto-instrumentation the
// docs recommend. That requires controlling the node invocation, which we don't
// on Vercel's serverless runtime. The cost is automatic tracing and richer
// request context; what we keep is the part that matters — every error reaching
// the central handler below gets reported.
//
// PRIVACY: same reasoning as src/sentry.js. No PII, no tracing, and query
// strings are stripped because /api/weather carries the user's coordinates.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV || "development",
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = String(event.request.url).split("?")[0];
      }
      delete event.request?.query_string;
      return event;
    },
  });
}

const app = express();

// We're deployed behind Vercel's reverse proxy. Without this, req.ip is the
// proxy's address for every request, so rate-limit buckets everyone into one
// shared bucket. Setting trust proxy = 1 tells Express to read the real
// client IP from X-Forwarded-For (one hop = Vercel's edge).
app.set("trust proxy", 1);

app.use(express.json());

// Exact-match origin allowlist. No wildcards: a substring/suffix check on
// *.vercel.app is attacker-satisfiable (anyone can name a Vercel project to
// match). Extra origins (e.g. preview deployments) go in ALLOWED_ORIGINS as
// a comma-separated env var. Auth is a Bearer token, not cookies, so CORS
// credentials are intentionally not enabled.
const allowedOrigins = new Set(
  [
    "https://custodian-2arm-azure.vercel.app",
    ...(process.env.ALLOWED_ORIGINS || "").split(","),
  ]
    .map((s) => s.trim())
    .filter(Boolean)
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      // Any localhost port — covers vite dev (5173) and vite preview (4173).
      if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
  })
);

// Rate limit the public weather endpoint so a bad actor can't burn through
// the OpenWeather API quota. NOTE: the default MemoryStore is per-instance,
// so on serverless this is only a soft brake — the real quota protection is
// the response cache in routes/weather.js.
const weatherLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // per IP
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", usersRouter);
app.use("/api/handoffs", verifyToken, handoffsRouter);

// Mixed auth inside: subscribe/settings use verifyToken per-route, dispatch
// uses the CRON_SECRET header (it's called by the scheduler, not a user).
app.use("/api/notifications", notificationsRouter);

// Weather is a public passthrough to OpenWeather. No user identity is
// involved, so it's intentionally not gated by verifyToken — guests need
// access too. Rate-limited and cached to protect the API key.
app.use("/api/weather", weatherLimiter, weatherRouter);

// Central error handler. Express 5 forwards rejected async handlers here.
// Log the real error server-side; never echo internals (DB error messages
// leak schema and connection details) back to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  console.error(err);
  // Reported after the CORS early-return on purpose: a blocked origin is
  // routine (someone hitting a preview URL, a scraper) rather than a bug, and
  // reporting it would bury real errors under noise.
  Sentry.captureException(err);
  res.status(500).json({ error: "Something went wrong" });
});

const port = process.env.PORT;

app.listen(port, () =>
  console.log(`server running on port ${port}`)
);

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import usersRouter from "./routes/users.js";
import handoffsRouter from "./routes/handoffs.js";
import weatherRouter from "./routes/weather.js";
import { verifyToken } from "./middleware/auth.js";

const app = express();

// We're deployed behind Vercel's reverse proxy. Without this, req.ip is the
// proxy's address for every request, so rate-limit buckets everyone into one
// shared bucket. Setting trust proxy = 1 tells Express to read the real
// client IP from X-Forwarded-For (one hop = Vercel's edge).
app.set("trust proxy", 1);

app.use(express.json());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (origin === "https://custodian-2arm-azure.vercel.app") {
        return callback(null, true);
      }

      if (origin === "http://localhost:5173") return callback(null, true);

      if (
        origin.endsWith(".vercel.app") &&
        origin.includes("custodian-2arm")
      ) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },

    credentials: true,
  })
);

// Rate limit the public weather endpoint so a bad actor can't burn through
// the OpenWeather API quota. 30 req/min/IP is plenty for legitimate use
// (one Evening page load makes one request) and painful for scrapers.
const weatherLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // per IP
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", usersRouter);
app.use("/api/handoffs", verifyToken, handoffsRouter);

// Weather is a public passthrough to OpenWeather. No user identity is
// involved, so it's intentionally not gated by verifyToken — guests need
// access too. Rate-limited to protect the API key.
app.use("/api/weather", weatherLimiter, weatherRouter);

const port = process.env.PORT;

app.listen(port, () =>
  console.log(`server running on port ${port}`)
);
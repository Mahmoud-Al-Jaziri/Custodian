import express from "express";
import cors from "cors";

import usersRouter from "./routes/users.js";
import handoffsRouter from "./routes/handoffs.js";
import weatherRouter from "./routes/weather.js";

import { verifyToken } from "./middleware/auth.js";

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: [
      "https://custodian-2arm-azure.vercel.app",
      "http://localhost:5173",
    ],

    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],

    credentials: true,
  })
);

app.options("*", cors());

app.get("/", (req, res) => {
  res.send("API running");
});

app.use("/api", usersRouter);

app.use(
  "/api/handoffs",
  verifyToken,
  handoffsRouter
);

app.use(
  "/api/weather",
  verifyToken,
  weatherRouter
);

app.use((err, req, res) => {
  console.error(err);

  res.status(500).json({
    error: err.message,
  });
});

export default app;
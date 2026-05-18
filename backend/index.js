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

app.use("/api", usersRouter);
app.use("/api/handoffs", verifyToken, handoffsRouter);
app.use("/api/weather", verifyToken, weatherRouter);

const port = process.env.PORT;

app.listen(port, () =>
  console.log(`server running on port ${port}`)
);
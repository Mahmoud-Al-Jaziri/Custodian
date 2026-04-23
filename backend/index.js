import express from "express";
import cors from "cors";
import usersRouter from "./routes/users.js";
import handoffsRouter from "./routes/handoffs.js";
import weatherRouter from "./routes/weather.js";

const app = express();
app.use(express.json());
app.use(cors({
  origin: "https://custodian-2arm-azure.vercel.app"
}));

app.use('/api',usersRouter);
app.use('/api/handoffs',handoffsRouter);
app.use('/api/weather',weatherRouter);

const port = process.env.PORT;

app.listen(port,()=>console.log(`server running on port ${port}`))
import express from "express"
import cors from "cors"
import usersRouter from "./routes/users.js"
import handoffsRouter from "./routes/handoffs.js"
import weatherRouter from "./routes/weather.js"

const app = express()

app.use(cors({
  origin: "https://custodian-2arm-azure.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}))

app.options("*", cors())
app.use(express.json())

app.use("/api", usersRouter)
app.use("/api/handoffs", handoffsRouter)
app.use("/api/weather", weatherRouter)

// for local development
if (process.env.NODE_ENV !== "production") {
  const port = process.env.PORT || 3000
  app.listen(port, () => console.log(`server running on port ${port}`))
}

export default app
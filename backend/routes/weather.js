import { Router } from "express"

const weatherRouter = Router()

weatherRouter.get("/", async (req, res) => {
  try {
    const { lat, lon } = req.query
    const key = process.env.OPENWEATHER_API_KEY

    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${key}&units=metric&cnt=8`

    const response = await fetch(url)
    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: data.message })
    }

    // tomorrow's first forecast slot
    const tomorrow = data.list[3]

    res.status(200).json({
      temp: Math.round(tomorrow.main.temp),
      feels_like: Math.round(tomorrow.main.feels_like),
      description: tomorrow.weather[0].description,
      humidity: tomorrow.main.humidity
    })
  } catch (err) {
    res.status(500).json({ error: err.message})
  }
})

export default weatherRouter
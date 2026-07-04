import { Router } from "express"

const weatherRouter = Router()

// Cache responses by rounded coordinates. Two decimal places ≈ 1.1 km, so
// everyone in the same neighborhood shares one OpenWeather call per TTL —
// this, not the per-instance rate limiter, is the real quota protection.
const CACHE_TTL_MS = 30 * 60 * 1000
const CACHE_MAX_ENTRIES = 500
const cache = new Map() // key → { at, payload }

weatherRouter.get("/", async (req, res) => {
  const lat = Number(req.query.lat)
  const lon = Number(req.query.lon)
  if (
    !Number.isFinite(lat) || !Number.isFinite(lon) ||
    Math.abs(lat) > 90 || Math.abs(lon) > 180
  ) {
    return res.status(400).json({ error: "lat and lon must be valid coordinates" })
  }

  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return res.status(200).json(hit.payload)
  }

  // URLSearchParams encodes values, so nothing from the query string can
  // smuggle extra parameters into our API-key'd upstream request.
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    appid: process.env.OPENWEATHER_API_KEY,
    units: "metric",
    cnt: "8",
  })

  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?${params}`
  )
  const data = await response.json()

  if (!response.ok || !Array.isArray(data.list) || data.list.length === 0) {
    console.error("OpenWeather error:", response.status, data?.message)
    return res.status(502).json({ error: "Weather is unavailable right now" })
  }

  // tomorrow's first forecast slot (3-hour steps)
  const tomorrow = data.list[Math.min(3, data.list.length - 1)]

  const payload = {
    temp: Math.round(tomorrow.main.temp),
    feels_like: Math.round(tomorrow.main.feels_like),
    description: tomorrow.weather[0].description,
    humidity: tomorrow.main.humidity,
  }

  // Bounded cache: drop the oldest entry once full (Map preserves insertion
  // order). Serverless instances are short-lived anyway; this just prevents
  // unbounded growth on a long-lived one.
  if (cache.size >= CACHE_MAX_ENTRIES) {
    cache.delete(cache.keys().next().value)
  }
  cache.set(cacheKey, { at: Date.now(), payload })

  res.status(200).json(payload)
})

export default weatherRouter

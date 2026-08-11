import { Router } from "express"
import pool from "../db.js"

const weatherRouter = Router()

// Cache by rounded coordinates. One decimal place is ~11 km, so everyone in
// the same town shares a single OpenWeather call. The previous two places
// (~1.1 km) gave nearly every user their own cache key, which is most of why
// the free tier (1000 calls/day) was the first thing that would break at
// launch — the cache existed but almost never hit.
const COORD_PRECISION = 1
const CACHE_TTL_MINUTES = 60
const CACHE_TTL_MS = CACHE_TTL_MINUTES * 60 * 1000

// Two tiers. L1 is this instance's memory: free and instant, but Vercel throws
// it away on every cold start, which is exactly why it can't be the only layer.
// L2 is Postgres — shared by every instance and durable across restarts. L2 is
// what actually holds the upstream call count down; L1 just saves it a round
// trip while an instance stays warm.
const CACHE_MAX_ENTRIES = 500
const memoryCache = new Map()

function readMemory(key) {
  const hit = memoryCache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.payload
  return null
}

function writeMemory(key, payload) {
  // Bounded: drop the oldest entry once full (Map preserves insertion order).
  if (memoryCache.size >= CACHE_MAX_ENTRIES) {
    memoryCache.delete(memoryCache.keys().next().value)
  }
  memoryCache.set(key, { at: Date.now(), payload })
}

// Both cache tiers are best-effort. Weather is a nice-to-have on the Evening
// page, so a database that's down or a table that hasn't been migrated yet
// must degrade to "call OpenWeather directly", never to a failed request.
async function readDatabase(key) {
  try {
    const result = await pool.query(
      `SELECT payload
       FROM weather_cache
       WHERE cache_key = $1
       AND fetched_at > NOW() - make_interval(mins => $2)`,
      [key, CACHE_TTL_MINUTES]
    )
    return result.rows[0]?.payload ?? null
  } catch (err) {
    console.error("weather cache read failed:", err.message)
    return null
  }
}

async function writeDatabase(key, payload) {
  try {
    await pool.query(
      `INSERT INTO weather_cache (cache_key, payload, fetched_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (cache_key)
       DO UPDATE SET payload = EXCLUDED.payload, fetched_at = NOW()`,
      [key, payload]
    )
  } catch (err) {
    console.error("weather cache write failed:", err.message)
  }
}

weatherRouter.get("/", async (req, res) => {
  const lat = Number(req.query.lat)
  const lon = Number(req.query.lon)
  if (
    !Number.isFinite(lat) || !Number.isFinite(lon) ||
    Math.abs(lat) > 90 || Math.abs(lon) > 180
  ) {
    return res.status(400).json({ error: "lat and lon must be valid coordinates" })
  }

  const cacheKey =
    `${lat.toFixed(COORD_PRECISION)},${lon.toFixed(COORD_PRECISION)}`

  const cached = readMemory(cacheKey) ?? (await readDatabase(cacheKey))
  if (cached) {
    writeMemory(cacheKey, cached)
    return res.status(200).json(cached)
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

  writeMemory(cacheKey, payload)
  await writeDatabase(cacheKey, payload)

  res.status(200).json(payload)
})

export default weatherRouter

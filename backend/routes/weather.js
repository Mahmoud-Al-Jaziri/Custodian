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

// Stale-row sweep. Runs on ~2% of cache misses, which is often enough to keep
// the table small and rare enough that it never becomes the request's cost.
const CLEANUP_PROBABILITY = 0.02
const CACHE_RETENTION_DAYS = 7

// Both tiers return { payload, at } so the ORIGINAL fetch time travels with
// the data. Re-stamping it on promotion would let a 59-minute-old database row
// live another full hour in memory — 2x the TTL we actually promise.
function readMemory(key) {
  const hit = memoryCache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit
  return null
}

function writeMemory(key, payload, at = Date.now()) {
  if (memoryCache.has(key)) {
    // Overwriting doesn't grow the Map, so there's nothing to evict. Delete
    // first anyway: Map.set keeps an existing key's original insertion
    // position, which would pin the busiest key at the head of the eviction
    // queue and make it the first thing dropped.
    memoryCache.delete(key)
  } else if (memoryCache.size >= CACHE_MAX_ENTRIES) {
    memoryCache.delete(memoryCache.keys().next().value)
  }
  memoryCache.set(key, { at, payload })
}

// Both cache tiers are best-effort. Weather is a nice-to-have on the Evening
// page, so a database that's down or a table that hasn't been migrated yet
// must degrade to "call OpenWeather directly", never to a failed request.
async function readDatabase(key) {
  try {
    const result = await pool.query(
      `SELECT payload, fetched_at
       FROM weather_cache
       WHERE cache_key = $1
       AND fetched_at > NOW() - make_interval(mins => $2)`,
      [key, CACHE_TTL_MINUTES]
    )
    const row = result.rows[0]
    if (!row) return null
    return { payload: row.payload, at: new Date(row.fetched_at).getTime() }
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

    // This endpoint is public, so the key space is NOT bounded by where real
    // users live — anyone can seed rows with arbitrary coordinates, and the
    // rate limiter caps how fast that happens but not the total. Sweep stale
    // rows occasionally rather than adding a cron just for this; the write
    // path is already the slow path (we only get here on a cache miss).
    if (Math.random() < CLEANUP_PROBABILITY) {
      const swept = await pool.query(
        `DELETE FROM weather_cache
         WHERE fetched_at < NOW() - make_interval(days => $1)`,
        [CACHE_RETENTION_DAYS]
      )
      if (swept.rowCount > 0) {
        console.log(`weather cache: swept ${swept.rowCount} stale rows`)
      }
    }
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
    // Carry cached.at through, don't restamp — see writeMemory.
    writeMemory(cacheKey, cached.payload, cached.at)
    return res.status(200).json(cached.payload)
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

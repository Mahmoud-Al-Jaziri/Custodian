// services/weather.js
//
// Weather is a public endpoint — it just proxies lat/lon to OpenWeather.
// No user identity is involved, so we don't send a Firebase token. This
// also lets guests see tomorrow's forecast on the Evening page.

const API_URL = import.meta.env.VITE_API_URL;

export async function getTomorrowWeather(lat, lon) {
  const res = await fetch(`${API_URL}/weather?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error("Failed to fetch weather");
  return res.json();
}
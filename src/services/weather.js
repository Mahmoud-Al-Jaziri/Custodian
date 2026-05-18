import { auth } from "../firebase";

const API_URL = import.meta.env.VITE_API_URL;

export async function getTomorrowWeather(lat, lon) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${API_URL}/weather?lat=${lat}&lon=${lon}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch weather");
  return res.json();
}
const API_URL = "http://localhost:3000/api";

export async function getTomorrowWeather(lat,lon){
    const res = await fetch(`${API_URL}/weather?lat=${lat}&lon=${lon}`)
    if (!res.ok) throw new Error("Failed to fetch weather")
    return res.json()
}

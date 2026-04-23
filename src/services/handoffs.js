const API_URL = import.meta.env.VITE_API_URL;

export async function createHandoff(user_id, note, one_thing, image_url = null) {
    const relay_date = new Date().toLocaleDateString("en-CA")
    const res = await fetch(`${API_URL}/handoffs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, note, one_thing, relay_date, image_url })
    })
    const data = await res.json();
    if (!res.ok) throw new Error(data.error)
    return data
}

export async function getAllHandoffs(user_id) {
    const res = await fetch(`${API_URL}/handoffs/${user_id}`)
    if (!res.ok) throw new Error("Failed to fetch handoffs")
    return res.json()
}

export async function getTodayHandoff(user_id){
    const today = new Date().toLocaleDateString("en-CA");
    const res = await fetch(`${API_URL}/handoffs/${user_id}/today?today=${today}`);
    if (!res.ok) throw new Error("Failed to fetch today handoff");
    return res.json();
}

export async function getLatestHandoff(user_id){
    
    const res = await fetch(`${API_URL}/handoffs/${user_id}/latest`)
    
    if (!res.ok) throw new Error("Failed to fetch handoff")
  return res.json()
}

export async function updateHandoff(id, note, one_thing) {
    const relay_date = new Date().toLocaleDateString("en-CA");

    const res = await fetch(`${API_URL}/handoffs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, one_thing, relay_date })
    });

    if (!res.ok) throw new Error("Failed to update handoff");
    return res.json();
}

export async function deleteHandoff(id) {
    const res = await fetch(`${API_URL}/handoffs/${id}`, {
        method: "DELETE"
    })
    if (!res.ok) throw new Error("Failed to delete handoff")
    return res.json()
}
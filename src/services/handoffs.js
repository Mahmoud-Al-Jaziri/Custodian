// services/handoffs.js
//
// Single interface for handoffs. Dispatches to local IndexedDB when the user
// is a guest, and to the cloud API when authenticated. Components never need
// to know which mode they're in.
//
// SECURITY NOTE: the API now derives the user's identity from the verified
// Firebase ID token on every request. We no longer send user_id in the URL
// or body — the server wouldn't trust it anyway.

import { auth } from "../firebase";
import {
  upsertLocalHandoff,
  getLocalHandoffByDate,
  getAllLocalHandoffs,
  getLatestLocalHandoff,
  deleteLocalHandoff,
} from "./localHandoffs";
import { uploadHandoffAttachment } from "./storage";

const API_URL = import.meta.env.VITE_API_URL;
const today = () => new Date().toLocaleDateString("en-CA");
const isGuest = () => !auth.currentUser;

async function authHeaders() {
  const token = await auth.currentUser.getIdToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// CREATE / UPSERT today's handoff.
// `attachment` is a raw File/Blob. For guests it's persisted locally as a Blob;
// for authenticated users it's uploaded to Firebase Storage and the URL is sent.
export async function createHandoff(note, oneThing, attachment = null) {
  const relay_date = today();

  if (isGuest()) {
    return upsertLocalHandoff({
      relay_date,
      note,
      one_thing: oneThing,
      attachment,
    });
  }

  let image_url = null;
  if (attachment) {
    image_url = await uploadHandoffAttachment(
      auth.currentUser.uid,
      relay_date,
      attachment
    );
  }

  const res = await fetch(`${API_URL}/handoffs`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      note,
      one_thing: oneThing,
      relay_date,
      image_url,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create handoff");
  return data;
}

export async function getTodayHandoff() {
  if (isGuest()) return getLocalHandoffByDate(today());

  const res = await fetch(`${API_URL}/handoffs/today?today=${today()}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch today's handoff");
  return res.json();
}

export async function getLatestHandoff() {
  if (isGuest()) return getLatestLocalHandoff();

  const res = await fetch(`${API_URL}/handoffs/latest`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch handoff");
  return res.json();
}

export async function getAllHandoffs() {
  if (isGuest()) return getAllLocalHandoffs();

  const res = await fetch(`${API_URL}/handoffs`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch handoffs");
  return res.json();
}

// Kept for parity with the previous service surface. The Edit flow isn't
// wired up in the UI yet, but if you add one later it'll work for both
// guests and authenticated users without further changes.
export async function updateHandoff(id, note, oneThing) {
  if (isGuest()) {
    const relay_date = id?.startsWith?.("local-") ? id.slice(6) : today();
    return upsertLocalHandoff({ relay_date, note, one_thing: oneThing });
  }

  const res = await fetch(`${API_URL}/handoffs/${id}`, {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify({ note, one_thing: oneThing, relay_date: today() }),
  });
  if (!res.ok) throw new Error("Failed to update handoff");
  return res.json();
}

export async function deleteHandoff(id) {
  if (isGuest()) {
    const relay_date = id?.startsWith?.("local-") ? id.slice(6) : today();
    await deleteLocalHandoff(relay_date);
    return { message: "Handoff deleted" };
  }

  const res = await fetch(`${API_URL}/handoffs/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete handoff");
  return res.json();
}
// services/handoffs.js
//
// Single interface for handoffs. Dispatches to local IndexedDB when the user
// is a guest, and to the cloud API when authenticated. Components never need
// to know which mode they're in.
//
// SECURITY NOTE: the API derives the user's identity from the verified
// Firebase ID token on every request. We never send user_id in the URL
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

// Cloud rows arrive with relay_date as a full ISO timestamp (Postgres DATE →
// JS Date → JSON). Local rows store plain "YYYY-MM-DD". Normalize HERE, at
// the service boundary, so consumers only ever see one shape and never have
// to slice dates themselves.
function normalize(h) {
  if (!h) return h;
  return {
    ...h,
    relay_date: h.relay_date ? String(h.relay_date).slice(0, 10) : h.relay_date,
  };
}

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
  return normalize(data);
}

export async function getTodayHandoff() {
  if (isGuest()) return getLocalHandoffByDate(today());

  const res = await fetch(`${API_URL}/handoffs/today?today=${today()}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch today's handoff");
  return normalize(await res.json());
}

export async function getLatestHandoff() {
  if (isGuest()) return getLatestLocalHandoff();

  const res = await fetch(`${API_URL}/handoffs/latest`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch handoff");
  return normalize(await res.json());
}

// Full records, newest first. Pass `limit` when you only need the first N —
// the cloud query then LIMITs server-side instead of shipping the archive.
export async function getAllHandoffs(limit = null) {
  if (isGuest()) {
    const all = await getAllLocalHandoffs();
    return limit ? all.slice(0, limit) : all;
  }

  const url = limit
    ? `${API_URL}/handoffs?limit=${limit}`
    : `${API_URL}/handoffs`;
  const res = await fetch(url, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch handoffs");
  return (await res.json()).map(normalize);
}

// Lightweight projection for the Dashboard: id/relay_date/one_thing only.
// Enough for the streak, the calendar, and the "one thing" card at a
// fraction of the payload of the full archive.
export async function getHandoffSummaries() {
  if (isGuest()) {
    const all = await getAllLocalHandoffs();
    return all.map(({ id, relay_date, one_thing }) => ({
      id,
      relay_date,
      one_thing,
    }));
  }

  const res = await fetch(`${API_URL}/handoffs?fields=summary`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch handoffs");
  return (await res.json()).map(normalize);
}

// Editing tonight's handoff is just another createHandoff() call — the API
// upserts on (user_id, relay_date) and guests upsert on the same key locally,
// so re-saving today overwrites today's row in both modes. There is no
// separate update endpoint; only today's handoff is editable by design.

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

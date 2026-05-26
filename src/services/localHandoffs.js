// services/localHandoffs.js
//
// Local-first storage for guest handoffs, backed by IndexedDB via idb-keyval.
// We key each handoff by relay_date (YYYY-MM-DD) so we preserve the cloud
// schema's "one handoff per user per day" invariant.
//
// Attachments are stored as raw Blobs alongside the record. IndexedDB
// supports binary natively, so no base64 encoding is needed.

import { get, set, del, keys, getMany } from "idb-keyval";

const PREFIX = "handoff:";
const key = (relayDate) => `${PREFIX}${relayDate}`;

const isHandoffKey = (k) => typeof k === "string" && k.startsWith(PREFIX);

export async function upsertLocalHandoff({
  relay_date,
  note,
  one_thing,
  attachment, // File | Blob | null — caller may omit on edit
}) {
  const existing = (await get(key(relay_date))) || {};

  const record = {
    id: existing.id || `local-${relay_date}`,
    relay_date,
    note,
    one_thing,
    // If caller passed a new attachment, replace; otherwise keep existing.
    attachment: attachment !== undefined ? attachment : existing.attachment ?? null,
    attachment_name:
      attachment !== undefined
        ? attachment?.name ?? null
        : existing.attachment_name ?? null,
    attachment_type:
      attachment !== undefined
        ? attachment?.type ?? null
        : existing.attachment_type ?? null,
    created_at: existing.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await set(key(relay_date), record);
  return record;
}

export async function getLocalHandoffByDate(relay_date) {
  return (await get(key(relay_date))) || null;
}

export async function getAllLocalHandoffs() {
  const handoffKeys = (await keys()).filter(isHandoffKey);
  if (handoffKeys.length === 0) return [];
  const values = await getMany(handoffKeys);
  // newest first, matching the cloud endpoint's ORDER BY relay_date DESC
  return values
    .filter(Boolean)
    .sort((a, b) => b.relay_date.localeCompare(a.relay_date));
}

export async function getLatestLocalHandoff() {
  const all = await getAllLocalHandoffs();
  return all[0] || null;
}

export async function deleteLocalHandoff(relay_date) {
  await del(key(relay_date));
}

export async function clearAllLocalHandoffs() {
  const handoffKeys = (await keys()).filter(isHandoffKey);
  await Promise.all(handoffKeys.map((k) => del(k)));
}

export async function countLocalHandoffs() {
  return (await keys()).filter(isHandoffKey).length;
}

// Helper for the UI: build a browser-displayable URL for a local Blob.
// Caller is responsible for revoking the URL when done with it.
export function blobUrlFor(record) {
  if (!record?.attachment) return null;
  if (!(record.attachment instanceof Blob)) return null;
  return URL.createObjectURL(record.attachment);
}

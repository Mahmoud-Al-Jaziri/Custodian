// services/migration.js
//
// Lifts a guest's local handoffs into the cloud after their first sign-in.
// Runs once, immediately after `signInWithEmailLink` resolves.
//
// Strategy:
//   1. Read everything from IndexedDB.
//   2. Upload each Blob attachment to Firebase Storage under the new uid.
//   3. POST the whole batch to /handoffs/bulk in a single transaction.
//      The backend upserts the users row + inserts handoffs atomically.
//   4. Only clear local storage after the server returns 2xx.

import { auth } from "../firebase";
import { uploadHandoffAttachment } from "./storage";
import {
  getAllLocalHandoffs,
  clearAllLocalHandoffs,
} from "./localHandoffs";

const API_URL = import.meta.env.VITE_API_URL;

export async function migrateGuestHandoffsToCloud() {
  if (!auth.currentUser) {
    throw new Error("Cannot migrate without an authenticated user");
  }

  const userId = auth.currentUser.uid;
  const local = await getAllLocalHandoffs();

  // Upload attachments first, in parallel, so the bulk payload has URLs.
  // If an individual upload fails we still preserve the note.
  const prepared = await Promise.all(
    local.map(async (h) => {
      let image_url = null;
      if (h.attachment instanceof Blob) {
        try {
          const fileLike =
            h.attachment instanceof File
              ? h.attachment
              : new File(
                  [h.attachment],
                  h.attachment_name || `${h.relay_date}.bin`,
                  {
                    type:
                      h.attachment_type ||
                      h.attachment.type ||
                      "application/octet-stream",
                  }
                );
          image_url = await uploadHandoffAttachment(
            userId,
            h.relay_date,
            fileLike
          );
        } catch (err) {
          console.error(`Attachment upload failed for ${h.relay_date}:`, err);
        }
      }
      return {
        relay_date: h.relay_date,
        note: h.note,
        one_thing: h.one_thing,
        image_url,
      };
    })
  );

  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${API_URL}/handoffs/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      handoffs: prepared,
      display_name: auth.currentUser.email,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Migration failed");
  }

  // Only clear local data after the server has acknowledged the write.
  await clearAllLocalHandoffs();
  return res.json();
}

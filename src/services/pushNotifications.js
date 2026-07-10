// services/pushNotifications.js
//
// Client side of the evening reminder. Talks to the service worker's
// PushManager and the /api/notifications endpoints. Signed-in users only —
// dispatch needs an identity to know who already wrote tonight.
//
// Support notes:
// - iOS: the Push API only exists once the app is installed to the home
//   screen (16.4+). In a plain Safari tab we report needsInstall.
// - `npm run dev` has no service worker (prod-only), so reminders read as
//   unavailable there; use a production build to test.

import { auth } from "../firebase";

const API_URL = import.meta.env.VITE_API_URL;
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function pushSupport() {
  const supported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  if (supported) return { supported: true, needsInstall: false };

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  return { supported: false, needsInstall: isIos && !standalone };
}

async function getRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

async function authHeaders() {
  const token = await auth.currentUser.getIdToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// Web Push wants the VAPID public key as a Uint8Array.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// Current state for the settings UI:
//   { available:false }                     — no SW (dev build / unsupported)
//   { available:true, enabled:false }       — supported, not subscribed
//   { available:true, enabled:true, hour }  — subscribed, reminder at `hour`
export async function getReminderState() {
  const reg = await getRegistration();
  if (!reg) return { available: false };

  const sub = await reg.pushManager.getSubscription();
  if (!sub || !auth.currentUser) return { available: true, enabled: false };

  const res = await fetch(
    `${API_URL}/notifications/settings?endpoint=${encodeURIComponent(sub.endpoint)}`,
    { headers: await authHeaders() }
  );
  if (!res.ok) return { available: true, enabled: false };
  const settings = await res.json();
  return settings
    ? { available: true, enabled: true, hour: settings.remind_hour }
    : { available: true, enabled: false };
}

// Enable (or re-time) the reminder. Must be called from a user gesture —
// browsers only allow the permission prompt in direct response to a tap.
export async function enableReminders(hour = 21) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      "Notifications are blocked. Allow them in your browser settings and try again."
    );
  }

  const reg = await getRegistration();
  if (!reg) {
    throw new Error("Reminders are available in the installed app.");
  }

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const res = await fetch(`${API_URL}/notifications/subscribe`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      subscription: sub.toJSON(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      remindHour: hour,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Couldn't save the reminder.");
  }
  return res.json();
}

export async function disableReminders() {
  const reg = await getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) return;

  // Best-effort server cleanup; the local unsubscribe is what stops pushes.
  if (auth.currentUser) {
    await fetch(`${API_URL}/notifications/subscribe`, {
      method: "DELETE",
      headers: await authHeaders(),
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
  }
  await sub.unsubscribe();
}

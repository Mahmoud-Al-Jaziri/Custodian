import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

// App Check — attests that requests come from THIS app, not a script holding
// a stolen config. The Firebase config above is public by design (it ships in
// the bundle), so without this anyone with a throwaway account can write to
// the Storage bucket directly. That's the one path in this app that can run
// up an unbounded bill, hence the attestation.
//
// Guarded on the key so the app still boots without it: a fresh clone, a
// preview deploy, or CI has no reCAPTCHA key and shouldn't crash on startup.
// Enforcement is a separate switch in the Firebase console — ship this,
// confirm the console's App Check metrics show verified requests, and only
// then turn enforcement on, or you lock out everyone still on the old bundle.
const appCheckSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

if (appCheckSiteKey) {
  // Localhost has no reCAPTCHA attestation. This makes the SDK print a debug
  // token to the console, which you register once under App Check → Apps →
  // Manage debug tokens. DEV-only: a debug token bypasses attestation, so it
  // must never reach a production bundle.
  if (import.meta.env.DEV) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    // Refresh in the background so a long evening writing session doesn't
    // hit an expired token at upload time.
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const storage = getStorage(app);

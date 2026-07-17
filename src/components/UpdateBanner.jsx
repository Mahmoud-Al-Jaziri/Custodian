import { useRegisterSW } from "virtual:pwa-register/react";

// Registers the service worker and keeps installed apps up to date.
//
// Why this exists: an installed PWA (desktop or iOS home screen) usually
// RESUMES instead of relaunching, so the browser's launch-time update check
// almost never runs — users stay on old builds indefinitely. So we check for
// a new version every hour and every time the app returns to the
// foreground, then offer a one-tap refresh instead of silently reloading
// (a surprise reload could discard a half-written evening note).
export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => registration.update().catch(() => {});
      setInterval(check, 60 * 60 * 1000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: "calc(72px + env(safe-area-inset-bottom))",
        zIndex: 1080,
        width: "min(402px, calc(100vw - 24px))",
        background: "#1a1a18",
        color: "#f6f4ef",
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      }}
    >
      <span style={{ fontSize: 12, flex: 1, lineHeight: 1.5 }}>
        A new version of Custodian is ready.
      </span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          background: "#BA7517",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 500,
          padding: "8px 14px",
          whiteSpace: "nowrap",
        }}
      >
        Refresh
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          color: "#9a9a94",
          fontSize: 16,
          lineHeight: 1,
          padding: 4,
        }}
      >
        ×
      </button>
    </div>
  );
}

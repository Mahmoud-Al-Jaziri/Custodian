// Shown when a render error escapes to the boundary in main.jsx. Without it a
// crash is a white screen — the user can't tell a bug from a dead app, and has
// no obvious way back. Reload is the honest recommendation: their handoffs live
// on the server (or in IndexedDB as a guest), so nothing is lost by retrying.
export default function ErrorFallback() {
  return (
    <div className="relay-shell">
      <main
        className="relay-main px-4 d-flex flex-column justify-content-center"
        style={{ minHeight: "90dvh" }}
      >
        <p className="screen-label mb-3">Something broke</p>
        <h1 className="font-serif fst-italic mb-3" style={{ fontSize: 28 }}>
          That wasn't supposed to happen.
        </h1>
        <p style={{ fontSize: 14, color: "#5a5a56", lineHeight: 1.7 }}>
          Your handoffs are safe. Reloading usually clears it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-amber w-100 py-3 border-0 mt-3"
          style={{ borderRadius: 10, fontSize: 14 }}
        >
          Reload
        </button>
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Evening from "./pages/Evening";
import Morning from "./pages/Morning";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import { useAuth } from "./context/useAuth";
import { countLocalHandoffs } from "./services/localHandoffs";
import { launchRoute } from "./utils/launchRoute";
import UpdateBanner from "./components/UpdateBanner";

// Time-aware landing: open on the screen that matches now (read in the
// morning, do during the day, write in the evening). A brand-new visitor
// skips straight to writing — the first note IS the onboarding; there is no
// intro deck and no tour.
function Landing() {
  const { user, loading } = useAuth();
  const [dest, setDest] = useState(null);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    // Signed-in users aren't first-timers — they just follow the clock.
    const decide = user
      ? Promise.resolve(launchRoute())
      : countLocalHandoffs()
          .then((n) => (n === 0 ? "/evening" : launchRoute()))
          .catch(() => launchRoute());
    decide.then((d) => {
      if (!cancelled) setDest(d);
    });
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  if (!dest) return null; // resolves in milliseconds; no flash worth showing
  return <Navigate to={dest} replace />;
}

function App() {
  return (
    <HashRouter>
      <UpdateBanner />
      <Routes>
        <Route path="/" element={<Landing />} />

        {/* All the main pages are guest-accessible. */}
        <Route path="/evening" element={<Evening />} />
        <Route path="/morning" element={<Morning />} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Old links (e.g. /onboarding) fall back to the landing logic. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;

import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Evening from "./pages/Evening";
import Morning from "./pages/Morning";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import AuthCallback from "./pages/AuthCallback";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to={
                localStorage.getItem("onboarded")
                  ? "/dashboard"
                  : "/onboarding"
              }
              replace
            />
          }
        />

        {/* All the main pages are now guest-accessible. */}
        <Route path="/evening" element={<Evening />} />
        <Route path="/morning" element={<Morning />} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/onboarding" element={<Onboarding />} />
      </Routes>
    </HashRouter>
  );
}

export default App;

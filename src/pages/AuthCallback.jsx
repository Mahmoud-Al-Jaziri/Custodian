import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner, Alert, Button, Form } from "react-bootstrap";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { auth } from "../firebase";
import { migrateGuestHandoffsToCloud } from "../services/migration";
import { EMAIL_STORAGE_KEY } from "./Login";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("verifying"); // verifying | needEmail | migrating | error
  const [error, setError] = useState("");
  const [emailInput, setEmailInput] = useState("");

  useEffect(() => {
    async function run() {
      try {
        if (!isSignInWithEmailLink(auth, window.location.href)) {
          setStatus("error");
          setError("This sign-in link is invalid or expired.");
          return;
        }

        const stored = window.localStorage.getItem(EMAIL_STORAGE_KEY);
        if (!stored) {
          // User clicked the link on a different browser/device than the one
          // that requested it. Ask them to type their email to confirm.
          setStatus("needEmail");
          return;
        }

        await finalize(stored);
      } catch (err) {
        console.error(err);
        setStatus("error");
        setError(err.message || "Sign-in failed.");
      }
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finalize(emailToUse) {
    setStatus("verifying");
    try {
      await signInWithEmailLink(auth, emailToUse, window.location.href);
      window.localStorage.removeItem(EMAIL_STORAGE_KEY);

      setStatus("migrating");
      await migrateGuestHandoffsToCloud();

      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setError(err.message || "Sign-in failed.");
    }
  }

  return (
    <div className="relay-shell">
      <main
        className="relay-main px-4 d-flex flex-column justify-content-center align-items-center"
        style={{ minHeight: "90dvh" }}
      >
        {status === "verifying" && (
          <>
            <Spinner animation="border" />
            <p className="mt-3" style={{ fontSize: 13, color: "#9a9a94" }}>
              Verifying...
            </p>
          </>
        )}

        {status === "migrating" && (
          <>
            <Spinner animation="border" />
            <p className="mt-3" style={{ fontSize: 13, color: "#9a9a94" }}>
              Carrying your relay forward...
            </p>
          </>
        )}

        {status === "needEmail" && (
          <div style={{ width: "100%", maxWidth: 360 }}>
            <p className="screen-label mb-2">One more thing</p>
            <h2
              className="font-serif fst-italic mb-3"
              style={{ fontSize: 22 }}
            >
              What's the email you used?
            </h2>
            <p style={{ fontSize: 12, color: "#9a9a94" }}>
              Looks like you opened the link in a different browser.
            </p>
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                if (emailInput) finalize(emailInput);
              }}
            >
              <Form.Control
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@example.com"
                className="mb-3"
                required
                autoFocus
              />
              <Button
                type="submit"
                className="btn-amber w-100 py-3 border-0"
                disabled={!emailInput}
              >
                Continue →
              </Button>
            </Form>
          </div>
        )}

        {status === "error" && (
          <div style={{ width: "100%", maxWidth: 360 }}>
            <Alert variant="warning">{error}</Alert>
            <Button
              className="btn-amber w-100 py-3 border-0"
              onClick={() => navigate("/login")}
            >
              Try again →
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

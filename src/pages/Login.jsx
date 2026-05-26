import { useState, useEffect } from "react";
import { sendSignInLinkToEmail } from "firebase/auth";
import { Form, Button, Alert, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { countLocalHandoffs } from "../services/localHandoffs";

export const EMAIL_STORAGE_KEY = "emailForSignIn";

export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [guestCount, setGuestCount] = useState(0);

  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    countLocalHandoffs().then(setGuestCount).catch(() => {});
  }, []);

  // If already signed in (somehow landed here), go to dashboard.
  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  const handleSendLink = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const actionCodeSettings = {
        // HashRouter: the callback route lives behind the `#`.
        url: `${window.location.origin}/#/auth/callback`,
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
      setSent(true);
    } catch (err) {
      console.error(err);
      setError(err.message || "Couldn't send the link. Try again?");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="relay-shell">
        <main
          className="relay-main px-4 d-flex flex-column justify-content-center"
          style={{ minHeight: "90dvh" }}
        >
          <p className="screen-label mb-3">Almost there</p>
          <h1
            className="font-serif fst-italic mb-3"
            style={{ fontSize: 28 }}
          >
            Check your inbox.
          </h1>
          <p style={{ fontSize: 14, color: "#5a5a56", lineHeight: 1.7 }}>
            We sent a sign-in link to <strong>{email}</strong>. Open it on this
            device to carry tomorrow-you forward.
          </p>
          <p style={{ fontSize: 12, color: "#9a9a94", marginTop: 24 }}>
            Wrong email?{" "}
            <Button
              variant="link"
              className="p-0 text-amber"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              style={{ fontSize: 12 }}
            >
              Try a different one
            </Button>
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="relay-shell">
      <main
        className="relay-main px-4 d-flex flex-column justify-content-center"
        style={{ minHeight: "90dvh" }}
      >
        <p className="screen-label mb-2">Begin carrying</p>

        <h1 className="font-serif fst-italic mb-1" style={{ fontSize: 28 }}>
          Welcome.
        </h1>

        <p className="mb-4" style={{ fontSize: 13, color: "#9a9a94" }}>
          One email, no password. Tomorrow-you thanks you.
        </p>

        {guestCount > 0 && (
          <div
            className="mb-4 p-3"
            style={{
              background: "#FAEEDA",
              borderRadius: 12,
              fontSize: 12,
              color: "#633806",
              lineHeight: 1.6,
            }}
          >
            You have{" "}
            <strong>
              {guestCount} handoff{guestCount === 1 ? "" : "s"}
            </strong>{" "}
            in this browser. Signing in carries{" "}
            {guestCount === 1 ? "it" : "them"} forward across devices.
          </div>
        )}

        <Form onSubmit={handleSendLink}>
          <Form.Group className="mb-3">
            <Form.Label style={{ fontSize: 12 }}>Email address</Form.Label>
            <Form.Control
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              required
              autoFocus
            />
          </Form.Group>

          {error && <Alert variant="warning">{error}</Alert>}

          <Button
            type="submit"
            disabled={loading || !email}
            className="btn-amber w-100 py-3 border-0 mb-3"
          >
            {loading ? (
              <>
                <Spinner size="sm" className="me-2" />
                Sending the link...
              </>
            ) : (
              "Send me a sign-in link →"
            )}
          </Button>
        </Form>

        <p
          className="text-center mb-0"
          style={{ fontSize: 12, color: "#9a9a94" }}
        >
          Or{" "}
          <Button
            variant="link"
            className="p-0 text-amber"
            style={{ fontSize: 12 }}
            onClick={() => navigate("/dashboard")}
          >
            keep going as a guest
          </Button>
        </p>
      </main>
    </div>
  );
}

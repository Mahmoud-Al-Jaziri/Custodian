import { useState, useEffect } from "react";
import {
  sendSignInLinkToEmail,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { Form, Button, Alert, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../context/useAuth";
import { countLocalHandoffs } from "../services/localHandoffs";
import { migrateGuestHandoffsToCloud } from "../services/migration";

export const EMAIL_STORAGE_KEY = "emailForSignIn";

// Official Google "G" mark. Inline SVG keeps it dependency-free and crisp.
const GoogleIcon = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 18 18"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      fill="#4285F4"
    />
    <path
      d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      fill="#34A853"
    />
    <path
      d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      fill="#FBBC05"
    />
    <path
      d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      fill="#EA4335"
    />
  </svg>
);

export default function Login() {
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  // Pause the auto-redirect while a sign-in is in flight so migration
  // completes before we leave the page.
  const [signingIn, setSigningIn] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [guestCount, setGuestCount] = useState(0);

  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    countLocalHandoffs().then(setGuestCount).catch(() => {});
  }, []);

  // If the user is already signed in (deep-link or refresh), send them to
  // the dashboard. We hold this back during an active sign-in flow because
  // we want to finish migration before navigating.
  useEffect(() => {
    if (user && !signingIn) navigate("/dashboard");
  }, [user, signingIn, navigate]);

  const handleGoogleSignIn = async () => {
    setError("");
    setSigningIn(true);
    setGoogleLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());

      // Google sign-in resolves synchronously, so we run the same migration
      // step the email-link callback runs. Idempotent: with 0 local
      // handoffs it just upserts the users row server-side.
      setMigrating(true);
      await migrateGuestHandoffsToCloud();

      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      // User closing the popup or rapid double-clicks are normal cancels.
      if (
        err.code !== "auth/popup-closed-by-user" &&
        err.code !== "auth/cancelled-popup-request"
      ) {
        setError(err.message || "Couldn't sign in. Try again?");
      }
      setSigningIn(false);
    } finally {
      setGoogleLoading(false);
      setMigrating(false);
    }
  };

  const handleSendLink = async (e) => {
    e.preventDefault();
    setError("");
    setEmailLoading(true);

    try {
      const actionCodeSettings = {
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
      setEmailLoading(false);
    }
  };

  // -------- "check your inbox" state ---------------------------------
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
            Sign-in link sent to <strong>{email}</strong>.
          </p>
          <p style={{ fontSize: 12, color: "#9a9a94" }}>
            Check spam if you don't see it.
          </p>
          <p style={{ fontSize: 12, color: "#9a9a94", marginTop: 24 }}>
            Wrong email?{" "}
            <Button
              variant="link"
              className="p-0 text-amber"
              style={{ fontSize: 12 }}
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
            >
              Try a different one
            </Button>
          </p>
        </main>
      </div>
    );
  }

  // -------- main login view -------------------------------------------
  const busy = googleLoading || emailLoading;

  const googleButtonLabel = migrating
    ? guestCount > 0
      ? `Carrying ${guestCount} handoff${guestCount === 1 ? "" : "s"} forward...`
      : "Setting things up..."
    : googleLoading
    ? "Signing in..."
    : null;

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
          Tomorrow-you, on any device.
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

        {error && (
          <Alert variant="warning" style={{ fontSize: 12 }}>
            {error}
          </Alert>
        )}

        {/* PRIMARY: Continue with Google */}
        <Button
          onClick={handleGoogleSignIn}
          disabled={busy}
          className="w-100 py-3 mb-3 d-flex align-items-center justify-content-center"
          style={{
            backgroundColor: "#ffffff",
            color: "#1a1a18",
            border: "1px solid #dadada",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            if (!busy) e.currentTarget.style.backgroundColor = "#f6f4ef";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#ffffff";
          }}
        >
          {googleButtonLabel ? (
            <>
              <Spinner size="sm" className="me-2" />
              {googleButtonLabel}
            </>
          ) : (
            <>
              <GoogleIcon />
              <span className="ms-2">Continue with Google</span>
            </>
          )}
        </Button>

        {/* Divider */}
        <div className="d-flex align-items-center my-2">
          <hr
            className="flex-grow-1"
            style={{ borderColor: "#d6d3cb", opacity: 0.6, margin: 0 }}
          />
          <span
            className="mx-3"
            style={{
              fontSize: 10,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#9a9a94",
            }}
          >
            or use email
          </span>
          <hr
            className="flex-grow-1"
            style={{ borderColor: "#d6d3cb", opacity: 0.6, margin: 0 }}
          />
        </div>

        {/* SECONDARY: email link */}
        <Form onSubmit={handleSendLink} className="mt-3">
          <Form.Group className="mb-2">
            <Form.Control
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              required
              disabled={busy}
            />
          </Form.Group>
          <Button
            type="submit"
            disabled={busy || !email}
            className="btn-amber w-100 py-3 border-0 mb-3"
          >
            {emailLoading ? (
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
            disabled={busy}
          >
            keep going as a guest
          </Button>
        </p>
      </main>
    </div>
  );
}
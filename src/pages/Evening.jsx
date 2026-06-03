import { useState, useEffect, useRef } from "react";
import { Button, Form, Stack, Alert } from "react-bootstrap";
import PageShell from "../components/Pageshell.jsx";
import { createHandoff, getTodayHandoff } from "../services/handoffs.js";
import { useAuth } from "../context/AuthContext.jsx";
import { getTomorrowWeather } from "../services/weather.js";
import { useNavigate } from "react-router-dom";

const PROMPTS = ["what I finished", "what's left", "how I feel", "a small win"];
// High safety backstop only — a real handoff never comes close. Protects the
// migration payload / storage from runaway pastes, not the user from writing.
const MAX_CHARS = 2000;
// The counter stays hidden until you've written a lot, so it reads as gentle
// awareness ("you're writing a lot tonight") rather than a limit.
const SOFT_COUNTER_AT = 250;
// Plain-text list continuation: pressing return on a line that starts with one
// of these markers auto-starts the next line with the same marker. The markers
// are just characters — nothing rich-text, so storage/rendering stay plain.
const LIST_LINE = /^(\s*)([-•*])\s+(.*)$/;

export default function Evening() {
  const { user, loading: authLoading } = useAuth();

  const [note, setNote] = useState("");
  const [oneThing, setOneThing] = useState("");

  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [saving, setSaving] = useState(false);

  const [alreadyPassed, setAlreadyPassed] = useState(false);
  const [checking, setChecking] = useState(true);

  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [locationStatus, setLocationStatus] = useState("idle");

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const navigate = useNavigate();
  const isGuest = !user;

  // --- writing experience: auto-grow + plain-text list continuation ------
  const textareaRef = useRef(null);
  // When we rewrite the note programmatically (list continuation), we stash
  // where the caret should land and restore it after React re-renders.
  const pendingCaret = useRef(null);

  const autoGrow = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // Grow on mount (covers a restored draft) and whenever the note changes,
  // and apply any pending caret position from list continuation.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    autoGrow(el);
    if (pendingCaret.current != null) {
      el.selectionStart = pendingCaret.current;
      el.selectionEnd = pendingCaret.current;
      pendingCaret.current = null;
    }
  }, [note]);

  const handleNoteKeyDown = (e) => {
    // Only the plain return key, with a collapsed cursor (no selection).
    if (e.key !== "Enter" || e.shiftKey) return;
    const el = e.target;
    if (el.selectionStart !== el.selectionEnd) return;

    const value = el.value;
    const caret = el.selectionStart;

    const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
    const lineEndRaw = value.indexOf("\n", caret);
    const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;
    const currentLine = value.slice(lineStart, lineEnd);

    const match = currentLine.match(LIST_LINE);
    if (!match) return; // not a list line — let return behave normally

    const [, indent, marker, content] = match;
    e.preventDefault();

    if (content.trim() === "") {
      // Return on an empty bullet exits the list: clear the marker, stay put.
      const next = value.slice(0, lineStart) + value.slice(lineEnd);
      pendingCaret.current = lineStart;
      setNote(next);
    } else {
      // Continue the list: new line with the same indent + marker.
      const insertion = `\n${indent}${marker} `;
      const next = value.slice(0, caret) + insertion + value.slice(caret);
      pendingCaret.current = caret + insertion.length;
      setNote(next);
    }
  };

  // CHECK IF USER ALREADY PASSED TODAY
  useEffect(() => {
    if (authLoading) return;

    async function checkToday() {
      try {
        const data = await getTodayHandoff();
        setAlreadyPassed(Boolean(data));
      } catch (err) {
        console.error(err);
      } finally {
        setChecking(false);
      }
    }
    checkToday();
  }, [authLoading, user]);

  // Tomorrow's forecast (no auth needed — it's just an open weather call)
  const requestLocation = async () => {
    setWeatherLoading(true);

    try {
      const permission = await navigator.permissions.query({
        name: "geolocation",
      });

      if (permission.state === "denied") {
        setLocationStatus("denied");
        setWeatherLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            setLocationStatus("granted");
            const { latitude, longitude } = position.coords;
            const data = await getTomorrowWeather(latitude, longitude);
            setWeather(data);
          } catch (err) {
            console.error(err);
          } finally {
            setWeatherLoading(false);
          }
        },
        (err) => {
          console.error("Location denied", err);
          setLocationStatus("denied");
          setWeatherLoading(false);
        }
      );

      permission.onchange = () => {
        if (permission.state === "granted") requestLocation();
      };
    } catch (err) {
      console.error(err);
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);

  // SUBMIT HANDOFF — service decides local vs cloud
  const handleSubmit = async () => {
    if (!note.trim()) return;

    setSaving(true);
    setError("");
    setSaved(false);

    try {
      if (file && !isGuest) setUploading(true);
      await createHandoff(note, oneThing, file);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  return (
    <PageShell>
      <p className="screen-label mb-3">Evening · Handoff</p>

      <p
        className="font-serif fst-italic mb-4"
        style={{ fontSize: 18, lineHeight: 1.5 }}
      >
        "What do you want tomorrow's you to know?"
      </p>

      {weatherLoading ? (
        <p style={{ fontSize: 12, color: "#9a9a94" }}>
          Getting tomorrow's weather...
        </p>
      ) : weather ? (
        <div
          id="weather-strip"
          className="mb-3 p-3"
          style={{
            background: "#f6f4ef",
            borderRadius: 12,
            fontSize: 12,
            color: "#5a5a56",
          }}
        >
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#9a9a94",
            }}
          >
            Tomorrow-you wakes up to
          </span>
          <p className="mb-0 mt-1" style={{ fontSize: 14, color: "#1a1a18" }}>
            {weather.temp}°C · {weather.description} · feels like{" "}
            {weather.feels_like}°C · {weather.humidity}% humidity
          </p>
        </div>
      ) : locationStatus === "denied" ? (
        <div
          className="mb-3 p-3"
          style={{
            background: "#f6f4ef",
            borderRadius: 12,
            fontSize: 12,
            color: "#5a5a56",
          }}
        >
          <p
            className="mb-2"
            style={{ fontSize: 13, display: "flex", alignItems: "center" }}
          >
            Location is blocked in your browser.
          </p>
          <p style={{ fontSize: 12, color: "#9a9a94" }}>
            Click the{" "}
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 16,
                verticalAlign: "middle",
                margin: "0 4px",
                color: "#9a9a94",
              }}
            >
              location_off
            </span>
            icon in the address bar → allow location → refresh the page so
            tomorrow-you is ready for the weather 🌦️.
          </p>
        </div>
      ) : (
        <div
          className="mb-3 p-3"
          style={{
            background: "#f6f4ef",
            borderRadius: 12,
            fontSize: 12,
            color: "#5a5a56",
          }}
        >
          <p className="mb-2" style={{ fontSize: 13 }}>
            🌤 See what tomorrow feels like
          </p>

          <Button
            size="sm"
            className="btn-amber border-0"
            onClick={requestLocation}
          >
            Enable location
          </Button>
        </div>
      )}

      {/* NOTE INPUT */}
      <Form.Control
        as="textarea"
        ref={textareaRef}
        rows={5}
        className="handoff-textarea p-3 mb-1"
        placeholder="I left you..."
        maxLength={MAX_CHARS}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          autoGrow(e.target);
        }}
        onKeyDown={handleNoteKeyDown}
        onFocus={(e) => {
          // Keep the field visible once the mobile keyboard animates in.
          const el = e.target;
          setTimeout(
            () => el.scrollIntoView({ block: "center", behavior: "smooth" }),
            300
          );
        }}
        style={{
          fontSize: 16, // < 16px makes iOS Safari zoom on focus
          resize: "none", // grows automatically; no manual drag handle
          overflow: "hidden", // hidden because the element grows instead of scrolling
        }}
      />

      <p
        className="text-end mb-3"
        style={{ fontSize: 10, color: "#9a9a94", minHeight: 14 }}
      >
        {note.length >= SOFT_COUNTER_AT ? `${note.length} characters` : ""}
      </p>

      {/* PROMPTS */}
      <div className="mb-3">
        {PROMPTS.map((p) => (
          <span
            key={p}
            className="prompt-chip"
            onClick={() => setNote((prev) => prev + (prev ? " " : "") + p)}
          >
            {p}
          </span>
        ))}
      </div>

      {/* THE ONE THING — the single instruction tomorrow-you acts on */}
      <div className="mb-3">
        <p className="screen-label text-amber mb-1">The one thing</p>
        <p
          className="font-serif fst-italic mb-2"
          style={{ fontSize: 14, color: "#5a5a56", lineHeight: 1.5 }}
        >
          If tomorrow-you does one thing, what is it?
        </p>
        <Form.Control
          type="text"
          placeholder="Start with…"
          style={{
            background: "#FAEEDA",
            border: "1px solid rgba(186,117,23,0.25)",
            borderRadius: 10,
            fontSize: 16,
            padding: "14px 16px",
            color: "#1a1a18",
          }}
          value={oneThing}
          onChange={(e) => setOneThing(e.target.value)}
        />
      </div>

      {/* FILE UPLOAD */}
      <div className="mb-3">
        <p
          style={{
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#9a9a94",
            marginBottom: 8,
          }}
        >
          Attach something for tomorrow-you
        </p>

        <Form.Control
          type="file"
          accept="image/*,.pdf,.doc,.docx"
          style={{
            background: "#f6f4ef",
            border: "none",
            borderRadius: 10,
            fontSize: 13,
          }}
          onChange={(e) => setFile(e.target.files[0] || null)}
        />

        {file && (
          <p style={{ fontSize: 11, color: "#9a9a94", marginTop: 6 }}>
            {file.name} · {(file.size / 1024).toFixed(1)} KB
          </p>
        )}
      </div>

      {/* STATE UI */}
      {saved ? (
        <>
          <Alert variant="success" style={{ fontSize: 12 }}>
            Baton passed. Tomorrow-you is ready.
          </Alert>

          {isGuest && (
            <div
              className="p-3 mb-2"
              style={{
                background: "#FAEEDA",
                borderRadius: 12,
                border: "1px solid rgba(186,117,23,0.2)",
              }}
            >
              <p
                className="font-serif fst-italic mb-2"
                style={{ fontSize: 13, color: "#633806", lineHeight: 1.6 }}
              >
                "This handoff lives in this browser. Sign in once and
                tomorrow-you can find it on any device."
              </p>
              <Button
                className="btn-amber w-100 border-0 py-2"
                style={{ fontSize: 12 }}
                onClick={() => navigate("/login")}
              >
                Save my relay →
              </Button>
              <p
                className="text-center mb-0 mt-2"
                style={{ fontSize: 11, color: "#9a9a94" }}
              >
                No password. Just an email link.
              </p>
            </div>
          )}
        </>
      ) : checking ? (
        <p style={{ fontSize: 12, color: "#9a9a94" }}>
          Checking today's baton...
        </p>
      ) : alreadyPassed ? (
        <Alert variant="secondary" style={{ fontSize: 12 }}>
          ⚠️ You already passed today's baton.
          <br />
          Come back tomorrow to continue the relay.
        </Alert>
      ) : (
        <>
          {error && (
            <Alert variant="warning" style={{ fontSize: 12 }}>
              {error}
            </Alert>
          )}

          <Stack gap={2}>
            <Button
              className="btn-amber w-100 py-3 border-0"
              onClick={handleSubmit}
              disabled={saving || !note.trim()}
              style={
                saving || !note.trim()
                  ? {
                      backgroundColor: "#e0e0e0",
                      color: "#8a8a8a",
                      cursor: "not-allowed",
                      opacity: 1,
                    }
                  : {}
              }
            >
              {uploading
                ? "Uploading file..."
                : saving
                ? "Passing..."
                : "SEAL AND PASS TO TOMORROW →"}
            </Button>
          </Stack>
        </>
      )}
    </PageShell>
  );
}
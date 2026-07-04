import { useState, useEffect, useRef, useCallback } from "react";
import { Button, Form, Stack, Alert } from "react-bootstrap";
import PageShell from "../components/Pageshell.jsx";
import { createHandoff, getTodayHandoff } from "../services/handoffs.js";
import { useAuth } from "../context/useAuth.js";
import { getTomorrowWeather } from "../services/weather.js";
import { useNavigate } from "react-router-dom";
import { Skel } from "../components/Skeleton.jsx";

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

  // Today's existing handoff, if any. Drives edit mode: when set, the form is
  // prefilled and re-saving overwrites today's row instead of creating a new
  // one. `wasEditing` is captured at submit time so the success copy reflects
  // the action even after `existing` updates.
  const [existing, setExisting] = useState(null);
  const [wasEditing, setWasEditing] = useState(false);
  const [checking, setChecking] = useState(true);

  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [locationStatus, setLocationStatus] = useState("idle");

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const navigate = useNavigate();
  const isGuest = !user;
  // Today's handoff already exists → the form edits it instead of creating one.
  const isEditing = Boolean(existing);

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
        setExisting(data);
      } catch (err) {
        console.error(err);
      } finally {
        setChecking(false);
      }
    }
    checkToday();
  }, [authLoading, user]);

  // Prefill the form from today's existing handoff so re-opening the page
  // shows what you wrote, ready to edit. Runs only when `existing` changes,
  // so it never clobbers in-progress typing.
  useEffect(() => {
    if (existing) {
      setNote(existing.note ?? "");
      setOneThing(existing.one_thing ?? "");
    }
  }, [existing]);

  // Tomorrow's forecast (no auth needed — it's just an open weather call)
  const requestLocation = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // SUBMIT HANDOFF — service decides local vs cloud
  const handleSubmit = async () => {
    if (!note.trim()) return;

    setSaving(true);
    setError("");
    setSaved(false);
    setWasEditing(Boolean(existing));

    try {
      if (file && !isGuest) setUploading(true);
      // createHandoff upserts on (user_id, relay_date), so this both creates
      // and edits today's handoff. Keep the returned row so the form stays in
      // edit mode if the user comes back.
      const record = await createHandoff(note, oneThing, file);
      setExisting(record);
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
        // Same footprint as the weather strip below, so it doesn't jump.
        <Skel h={72} r={12} className="mb-3" />
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

      {/* FILE UPLOAD — hidden input behind a tappable label; the chosen file
          shows as a removable pill instead of the raw browser control. */}
      <div className="mb-3">
        <p className="screen-label mb-2">Attach something for tomorrow-you</p>

        {file ? (
          <div className="attach-file">
            <span className="text-truncate">
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </span>
            <button
              type="button"
              className="attach-remove"
              aria-label="Remove attachment"
              onClick={() => setFile(null)}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18 }}
                aria-hidden="true"
              >
                close
              </span>
            </button>
          </div>
        ) : (
          <label className="attach-btn">
            <span className="material-symbols-outlined" aria-hidden="true">
              add_photo_alternate
            </span>
            Add a photo or file
            <input
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              hidden
              onChange={(e) => setFile(e.target.files[0] || null)}
            />
          </label>
        )}
      </div>

      {/* STATE UI */}
      {saved ? (
        <>
          <Alert variant="success" style={{ fontSize: 12 }}>
            {wasEditing
              ? "Baton updated. Tomorrow-you has the latest."
              : "Baton passed. Tomorrow-you is ready."}
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
        // Stand-in for the submit button while we look up today's handoff.
        <Skel h={54} r={12} />
      ) : (
        <>
          {error && (
            <Alert variant="warning" style={{ fontSize: 12 }}>
              {error}
            </Alert>
          )}

          {isEditing && (
            <p
              className="mb-2"
              style={{ fontSize: 12, color: "#9a9a94" }}
            >
              You already passed today's baton — you can revise it until the
              day ends.
            </p>
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
                ? isEditing
                  ? "Updating..."
                  : "Passing..."
                : isEditing
                ? "UPDATE TONIGHT'S BATON →"
                : "SEAL AND PASS TO TOMORROW →"}
            </Button>
          </Stack>
        </>
      )}
    </PageShell>
  );
}
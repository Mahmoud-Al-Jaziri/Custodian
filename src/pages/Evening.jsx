import { useState, useEffect } from "react";
import { Button, Form, Stack, Alert } from "react-bootstrap";
import PageShell from "../components/Pageshell.jsx";
import { createHandoff, getTodayHandoff } from "../services/handoffs.js";
import { useAuth } from "../context/AuthContext.jsx";
import { getTomorrowWeather } from "../services/weather.js";
import { uploadHandoffAttachment } from "../services/storage.js"

const PROMPTS = ["what I finished", "what's left", "how I feel", "a small win"];
const MAX_CHARS = 280;

export default function Evening() {
  const { user } = useAuth();

  const [note, setNote] = useState("");
  const [oneThing, setOneThing] = useState("");

  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [saving, setSaving] = useState(false);

  const [alreadyPassed, setAlreadyPassed] = useState(false);
  const [checking, setChecking] = useState(true);

  const [weather,setWeather] = useState(null)

  const [weatherLoading, setWeatherLoading] = useState(true);
  const [locationStatus, setLocationStatus] = useState("idle");

  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  // CHECK IF USER ALREADY PASSED TODAY
  useEffect(() => {
    async function checkToday() {
      try {
        const data = await getTodayHandoff(user.uid);

        // convert object/null → boolean
        setAlreadyPassed(Boolean(data));
      } catch (err) {
        console.error(err);
      } finally {
        setChecking(false);
      }
    }

    if (user) checkToday();
  }, [user]);

  //get tomorrow forcast based on user geo location
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
        if (permission.state === "granted") {
          requestLocation();
        }
      };

    } catch (err) {
      console.error(err);
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);
  
  // SUBMIT HANDOFF
  const handleSubmit = async () => {
    if (!note.trim()) return;

    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const relay_date = new Date().toLocaleDateString("en-CA");
      let image_url = null;
      
      if(file){
        setUploading(true)
        image_url = await uploadHandoffAttachment(user.uid, relay_date, file)
        setUploading(false)
      }

      await createHandoff(user.uid, note, oneThing, image_url);

      setSaved(true);// lock UI immediately
       
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  // UI
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
          Getting tomorrow’s weather...
        </p>
      ) : weather ? (
        <div
          id="weather-strip"
          className="mb-3 p-3"
          style={{
            background: "#f6f4ef",
            borderRadius: 12,
            fontSize: 12,
            color: "#5a5a56"
          }}
        >
          <span style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9a94" }}>
            Tomorrow-you wakes up to
          </span>
          <p className="mb-0 mt-1" style={{ fontSize: 14, color: "#1a1a18" }}>
            {weather.temp}°C · {weather.description} · feels like {weather.feels_like}°C · {weather.humidity}% humidity
          </p>
        </div>
      ) : locationStatus === "denied" ? (
        <div
          className="mb-3 p-3"
          style={{
            background: "#f6f4ef",
            borderRadius: 12,
            fontSize: 12,
            color: "#5a5a56"
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
                  color: "#9a9a94"
                }}
              >
                location_off
              </span>
               icon in the address bar → allow location → refresh the page so tomorrow-you is ready for the weather 🌦️.
          </p>
        </div>
      ) : (
        <div
          className="mb-3 p-3"
          style={{
            background: "#f6f4ef",
            borderRadius: 12,
            fontSize: 12,
            color: "#5a5a56"
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
        rows={5}
        className="handoff-textarea p-3 mb-1"
        placeholder="I left you..."
        maxLength={MAX_CHARS}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <p className="text-end mb-3" style={{ fontSize: 10, color: "#9a9a94" }}>
        {note.length} / {MAX_CHARS}
      </p>

      {/* PROMPTS */}
      <div className="mb-3">
        {PROMPTS.map((p) => (
          <span
            key={p}
            className="prompt-chip"
            onClick={() =>
              setNote((prev) => prev + (prev ? " " : "") + p)
            }
          >
            {p}
          </span>
        ))}
      </div>

      {/* ONE THING INPUT */}
      <Form.Control
        type="text"
        placeholder="One thing forward for tomorrow-you (optional)"
        className="mb-3"
        style={{
          background: "#f6f4ef",
          border: "none",
          borderRadius: 10,
          fontSize: 13,
        }}
        value={oneThing}
        onChange={(e) => setOneThing(e.target.value)}
      />

      {/*FILE UPLOAD*/}

      <div className="mb-3">
        <p
          style={{
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#9a9a94",
            marginBottom: 8
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
            fontSize: 13
          }}
          onChange={(e) => setFile(e.target.files[0] || null)}
        />

        {file && (
          <p style={{ fontSize: 11, color: "#9a9a94", marginTop: 6 }}>
            {file.name} · {(file.size / 1024).toFixed(1)} KB
          </p>
        )}
      </div>

      {/*STATE UI (IMPORTANT PART)*/}

      {saved ? (
        <Alert variant="success" style={{ fontSize: 12 }}>
            Baton passed. Tomorrow-you is ready.
        </Alert>
        ) : checking ? (
        <p style={{ fontSize: 12, color: "#9a9a94" }}>
            Checking today's baton...
        </p>
        ) : alreadyPassed ? (
        <Alert variant="secondary" style={{ fontSize: 12 }}>
            ⚠️ You already passed today’s baton.
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
              {uploading ? "Uploading file..." : saving ? "Passing..." : "SEAL AND PASS TO TOMORROW →"}
            </Button>
          </Stack>
        </>
      )}
    </PageShell>
  );
}
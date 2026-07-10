import { useEffect, useState } from "react";
import { Card, Form, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import {
  pushSupport,
  getReminderState,
  enableReminders,
  disableReminders,
} from "../services/pushNotifications";

// Evening hours only — this is a "before you sleep" nudge, not an alarm app.
const HOURS = [18, 19, 20, 21, 22, 23];
const hourLabel = (h) => `${String(h).padStart(2, "0")}:00`;

export default function ReminderCard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState(null); // null = checking
  const [hour, setHour] = useState(21);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    getReminderState()
      .then((s) => {
        if (cancelled) return;
        setState(s);
        if (s.enabled) setHour(s.hour);
      })
      .catch(() => !cancelled && setState({ available: false }));
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const apply = async (enabled, nextHour) => {
    setBusy(true);
    setError("");
    try {
      if (enabled) {
        await enableReminders(nextHour);
        setState({ available: true, enabled: true, hour: nextHour });
        setHour(nextHour);
      } else {
        await disableReminders();
        setState({ available: true, enabled: false });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) return null;

  // Guests: the reminder is a cloud feature — one more reason to sign in.
  if (!user) {
    return (
      <Card className="one-thing-card mb-3">
        <Card.Body className="p-3">
          <p className="screen-label text-amber mb-2">Evening reminder</p>
          <p
            className="font-serif fst-italic mb-2"
            style={{ fontSize: 13, color: "#5a5a56", lineHeight: 1.6 }}
          >
            A quiet nudge each night, so tomorrow-you never wakes up to
            silence.
          </p>
          <Button
            size="sm"
            className="btn-amber border-0"
            style={{ fontSize: 12 }}
            onClick={() => navigate("/login")}
          >
            Sign in to get reminders →
          </Button>
        </Card.Body>
      </Card>
    );
  }

  const support = pushSupport();

  return (
    <Card className="one-thing-card mb-3">
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between align-items-center">
          <p className="screen-label text-amber mb-0">Evening reminder</p>
          {state?.available && (
            <Form.Check
              type="switch"
              id="reminder-switch"
              checked={Boolean(state?.enabled)}
              disabled={busy}
              onChange={(e) => apply(e.target.checked, hour)}
              aria-label="Evening reminder"
            />
          )}
        </div>

        {support.needsInstall ? (
          <p className="mb-0 mt-2" style={{ fontSize: 12, color: "#9a9a94" }}>
            Add Custodian to your home screen (Share → Add to Home Screen) to
            get evening reminders on this device.
          </p>
        ) : !support.supported ? (
          <p className="mb-0 mt-2" style={{ fontSize: 12, color: "#9a9a94" }}>
            This browser doesn't support reminders.
          </p>
        ) : state === null ? (
          <p className="mb-0 mt-2" style={{ fontSize: 12, color: "#9a9a94" }}>
            Checking…
          </p>
        ) : !state.available ? (
          <p className="mb-0 mt-2" style={{ fontSize: 12, color: "#9a9a94" }}>
            Reminders are available in the installed app.
          </p>
        ) : state.enabled ? (
          <div className="d-flex align-items-center gap-2 mt-2">
            <span style={{ fontSize: 12, color: "#5a5a56" }}>
              Nudge me at
            </span>
            <Form.Select
              size="sm"
              value={hour}
              disabled={busy}
              onChange={(e) => apply(true, Number(e.target.value))}
              style={{ width: 90, fontSize: 12 }}
              aria-label="Reminder hour"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </Form.Select>
          </div>
        ) : (
          <p className="mb-0 mt-2" style={{ fontSize: 12, color: "#9a9a94" }}>
            One tap each evening keeps the relay alive. Flip the switch.
          </p>
        )}

        {error && (
          <p className="mb-0 mt-2" style={{ fontSize: 11, color: "#a15c07" }}>
            {error}
          </p>
        )}
      </Card.Body>
    </Card>
  );
}

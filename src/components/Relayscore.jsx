import { Card } from "react-bootstrap";
import MonthCalendar from "./MonthCalendar";

// Short, in-voice line shown under the streak. `active` shows nothing — no need
// to narrate a streak that's simply going well.
const MESSAGES = {
  empty: "Write tonight to start your relay.",
  fresh: "A fresh start. Carry it tonight.",
  active: null,
  atRisk: "No rest nights left — tonight keeps it going.",
  broken: null, // built dynamically below so it can include `best`
};

export default function RelayScore({
  current = 0,
  best = 0,
  grace = 2,
  graceMax = 2,
  todayWritten = false,
  status = "empty",
  history = [],
  handoffs = [],
}) {
  let message = MESSAGES[status];
  if (status === "broken") {
    message = `Baton dropped after ${best} ${
      best === 1 ? "night" : "nights"
    } — your best yet. Pick it up tonight.`;
  }

  // Build the Set of written dates for the calendar.
  //
  // THE FIX: Postgres returns the DATE column as a JS Date, which JSON-
  // serialises to an ISO timestamp like "2026-06-12T00:00:00.000Z" — so for
  // signed-in users `h.relay_date` was never equal to the calendar's plain
  // "YYYY-MM-DD" keys and no day ever turned amber. Guests were unaffected
  // because IndexedDB stores the plain string. Slicing to the first 10 chars
  // normalises both shapes — the exact same trick relayStreak.js already uses.
  const writtenDates = new Set(
    handoffs
      .filter((h) => h.relay_date)
      .map((h) => String(h.relay_date).slice(0, 10))
  );

  return (
    <Card className="score-ring-wrap border-0 mb-3">
      <Card.Body className="p-3">
        {/* Top row: streak number + summary */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <div style={{ fontSize: 34, fontWeight: 300, lineHeight: 1 }}>
              {current}
              <span
                style={{ fontSize: 14, color: "#9a9a94", marginLeft: 4 }}
              >
                {current === 1 ? "night" : "nights"}
              </span>
            </div>
            <p className="screen-label mb-0 mt-1">night streak</p>
          </div>

          <div className="text-end">
            <span className="screen-label mb-0 d-block" style={{ color: "#9a9a94" }}>
              Best {best}
            </span>
            <span style={{ fontSize: 11, color: "#9a9a94" }}>
              rest{" "}
              {Array.from({ length: graceMax }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    color: "var(--amber)",
                    opacity: i < grace ? 1 : 0.25,
                    marginLeft: 2,
                  }}
                >
                  ●
                </span>
              ))}
            </span>
          </div>
        </div>

        {/* Month calendar — replaces the old 7-day bar strip */}
        <MonthCalendar writtenDates={writtenDates} />

        {message && (
          <p
            className="mb-0 mt-3 font-serif fst-italic"
            style={{ fontSize: 12, color: "#9a7548", lineHeight: 1.5 }}
          >
            {message}
          </p>
        )}
      </Card.Body>
    </Card>
  );
}
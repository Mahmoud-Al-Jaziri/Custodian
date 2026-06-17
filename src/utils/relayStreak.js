// utils/relayStreak.js
//
// Computes a forgiving night-streak from a list of handoffs.
//
// Why forgiving: a raw streak resets to zero the moment a committed user misses
// one night — often for reasons outside their control — which is the classic
// way streak mechanics cause churn. So a small buffer of "rest nights" absorbs
// the occasional miss, and a broken run is never erased: the longest streak is
// always banked as `best`, reframing a break as a record to beat rather than a
// loss.
//
// Everything is computed in LOCAL calendar days (YYYY-MM-DD). This is what
// fixes the old percentage bugs: no mismatched units (the 150% came from
// dividing calendar-day counts by elapsed-millisecond counts), and no
// timezone off-by-one for late-night handoffs.

const GRACE_MAX = 2; // rest nights you can hold at once
const REFILL_EVERY = 7; // earn one rest night per 7 consecutive written nights
const STRIP_DAYS = 7; // length of the little history strip

// Local YYYY-MM-DD for a Date.
function ymd(date) {
  return date.toLocaleDateString("en-CA");
}

// Step a YYYY-MM-DD string by `delta` days, staying in the local calendar.
// Anchored at local noon so a DST transition can't flip the date.
function addDays(ymdStr, delta) {
  const [y, m, d] = ymdStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + delta);
  return ymd(dt);
}

export function computeRelayStreak(handoffs, now = new Date()) {
  const today = ymd(now);

  // Unique set of local calendar days with a handoff. The filter also drops any
  // null relay_date, which previously slipped `undefined` into the count.
  const written = new Set(
    (handoffs || [])
      .map((h) => (h.relay_date ? String(h.relay_date).slice(0, 10) : null))
      .filter(Boolean)
  );

  const totalDays = written.size; // powers the "days of carrying" badge

  // 7-night history strip, oldest → newest, with today flagged as pending.
  const history = [];
  for (let i = STRIP_DAYS - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    history.push({ date, filled: written.has(date), today: date === today });
  }

  if (written.size === 0) {
    return {
      current: 0,
      best: 0,
      grace: GRACE_MAX,
      graceMax: GRACE_MAX,
      totalDays: 0,
      todayWritten: false,
      status: "empty",
      history,
    };
  }

  // Forward simulation from the first written day through today.
  const firstDay = [...written].sort()[0]; // string sort of YYYY-MM-DD is chronological
  let current = 0;
  let best = 0;
  let grace = GRACE_MAX;
  let writtenRun = 0;

  let cursor = firstDay;
  for (let guard = 0; guard < 4000; guard++) {
    if (written.has(cursor)) {
      current += 1;
      writtenRun += 1;
      if (writtenRun % REFILL_EVERY === 0) grace = Math.min(GRACE_MAX, grace + 1);
      if (current > best) best = current;
    } else if (cursor === today) {
      // Today isn't written *yet* — you write in the evening, so this is not a
      // miss. Leave the streak as-is; the day is pending.
    } else if (grace > 0) {
      // A rest night absorbs the miss: the streak holds but doesn't grow.
      grace -= 1;
      writtenRun = 0;
    } else {
      // No rest nights left → the streak truly breaks.
      current = 0;
      writtenRun = 0;
      grace = GRACE_MAX; // a fresh run gets a fresh cushion
    }

    if (cursor === today) break;
    cursor = addDays(cursor, 1);
  }

  const todayWritten = written.has(today);

  let status;
  if (current === 0) {
    status = best > 0 ? "broken" : "fresh";
  } else if (grace === 0 && !todayWritten) {
    status = "atRisk"; // no cushion and tonight not done
  } else {
    status = "active";
  }

  return {
    current,
    best,
    grace,
    graceMax: GRACE_MAX,
    totalDays,
    todayWritten,
    status,
    history,
  };
}
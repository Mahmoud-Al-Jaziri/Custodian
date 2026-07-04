import { describe, it, expect } from "vitest";
import { computeRelayStreak } from "./relayStreak.js";

// All cases run against a fixed "now" so results never depend on when the
// suite runs. day(0) = "today", day(-1) = yesterday, etc., in local time —
// matching how relayStreak does all of its date math.
const NOW = new Date(2026, 5, 20, 21, 0, 0); // Sat 2026-06-20, 9pm local

const day = (offset) => {
  const dt = new Date(2026, 5, 20, 12, 0, 0);
  dt.setDate(dt.getDate() + offset);
  return dt.toLocaleDateString("en-CA");
};

const handoffs = (...offsets) => offsets.map((o) => ({ relay_date: day(o) }));

describe("computeRelayStreak", () => {
  it("returns the empty state for no handoffs", () => {
    const s = computeRelayStreak([], NOW);
    expect(s).toMatchObject({
      current: 0,
      best: 0,
      grace: 2,
      graceMax: 2,
      totalDays: 0,
      todayWritten: false,
      status: "empty",
    });
    expect(s.history).toHaveLength(7);
  });

  it("tolerates a missing handoffs argument", () => {
    expect(computeRelayStreak(undefined, NOW).status).toBe("empty");
  });

  it("counts a single handoff written today", () => {
    const s = computeRelayStreak(handoffs(0), NOW);
    expect(s.current).toBe(1);
    expect(s.todayWritten).toBe(true);
    expect(s.status).toBe("active");
    expect(s.totalDays).toBe(1);
  });

  it("does not treat an unwritten today as a miss", () => {
    const s = computeRelayStreak(handoffs(-3, -2, -1), NOW);
    expect(s.current).toBe(3);
    expect(s.todayWritten).toBe(false);
    expect(s.status).toBe("active");
    expect(s.grace).toBe(2);
  });

  it("absorbs a single missed night with a rest night", () => {
    // wrote -3 and -2, missed -1
    const s = computeRelayStreak(handoffs(-3, -2), NOW);
    expect(s.current).toBe(2);
    expect(s.grace).toBe(1);
    expect(s.status).toBe("active");
  });

  it("flags atRisk when both rest nights are spent and tonight is pending", () => {
    // wrote -4 and -3, missed -2 and -1
    const s = computeRelayStreak(handoffs(-4, -3), NOW);
    expect(s.current).toBe(2);
    expect(s.grace).toBe(0);
    expect(s.status).toBe("atRisk");
  });

  it("breaks the streak on a third consecutive miss and banks the best", () => {
    // wrote -5 and -4, missed -3, -2, -1
    const s = computeRelayStreak(handoffs(-5, -4), NOW);
    expect(s.current).toBe(0);
    expect(s.best).toBe(2);
    expect(s.status).toBe("broken");
    expect(s.grace).toBe(2); // fresh run gets a fresh cushion
  });

  it("keeps the banked best across a break while a new run grows", () => {
    // 5-night run, long gap, then one fresh night
    const s = computeRelayStreak(handoffs(-12, -11, -10, -9, -8, -1), NOW);
    expect(s.best).toBe(5);
    expect(s.current).toBe(1);
    expect(s.status).toBe("active");
  });

  it("refills a rest night after 7 consecutive written nights", () => {
    // miss at -8 burns one rest night; the 7-night run -7..-1 earns it back
    const s = computeRelayStreak(handoffs(-9, -7, -6, -5, -4, -3, -2, -1), NOW);
    expect(s.current).toBe(8);
    expect(s.grace).toBe(2);
  });

  it("normalizes ISO-timestamp relay_dates (Postgres DATE over JSON)", () => {
    const s = computeRelayStreak(
      [{ relay_date: `${day(0)}T00:00:00.000Z` }],
      NOW
    );
    expect(s.todayWritten).toBe(true);
    expect(s.current).toBe(1);
  });

  it("ignores records with a null relay_date", () => {
    const s = computeRelayStreak(
      [{ relay_date: null }, { relay_date: undefined }],
      NOW
    );
    expect(s.status).toBe("empty");
    expect(s.totalDays).toBe(0);
  });

  it("dedupes multiple records on the same day", () => {
    const s = computeRelayStreak(
      [{ relay_date: day(0) }, { relay_date: day(0) }],
      NOW
    );
    expect(s.totalDays).toBe(1);
    expect(s.current).toBe(1);
  });

  it("builds a 7-day history strip ending on today", () => {
    const s = computeRelayStreak(handoffs(-1), NOW);
    expect(s.history).toHaveLength(7);
    expect(s.history[6]).toMatchObject({ date: day(0), today: true, filled: false });
    expect(s.history[5]).toMatchObject({ date: day(-1), filled: true });
    expect(s.history[0].date).toBe(day(-6));
  });
});

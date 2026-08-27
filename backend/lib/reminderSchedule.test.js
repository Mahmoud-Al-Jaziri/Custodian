import { describe, it, expect } from "vitest";
import { isDue } from "./reminderSchedule.js";

// A user who picked 6pm, in their own timezone.
const base = { remindHour: 18, lastSentDate: null, localDate: "2026-08-16" };

describe("isDue", () => {
  it("fires at the chosen hour when nothing has been sent today", () => {
    expect(isDue({ ...base, localHour: 18 })).toBe(true);
  });

  it("fires during the grace hour if the chosen hour was missed", () => {
    // The scheduler is best-effort; a dropped or badly delayed run must not
    // cost the user their reminder entirely.
    expect(isDue({ ...base, localHour: 19 })).toBe(true);
  });

  it("does NOT fire again in the grace hour once already sent", () => {
    // THE BUG. This returned true in production, so everyone who got a
    // reminder at 6:20 got a second one at 7:20.
    expect(
      isDue({ ...base, lastSentDate: "2026-08-16", localHour: 19 })
    ).toBe(false);
  });

  it("does not re-fire within the chosen hour either", () => {
    expect(
      isDue({ ...base, lastSentDate: "2026-08-16", localHour: 18 })
    ).toBe(false);
  });

  it("fires the next day even though yesterday was sent", () => {
    expect(
      isDue({ ...base, lastSentDate: "2026-08-15", localHour: 18 })
    ).toBe(true);
  });

  it("stays quiet outside the window", () => {
    for (const localHour of [0, 6, 17, 20, 23]) {
      expect(isDue({ ...base, localHour }), `hour ${localHour}`).toBe(false);
    }
  });

  it("wraps the grace hour across midnight", () => {
    // 11pm reminder → grace hour is midnight, not hour 24.
    expect(
      isDue({ remindHour: 23, lastSentDate: null, localDate: "2026-08-16", localHour: 0 })
    ).toBe(true);
    expect(
      isDue({ remindHour: 23, lastSentDate: null, localDate: "2026-08-16", localHour: 22 })
    ).toBe(false);
  });

  it("throws on a Date instead of silently nagging twice", () => {
    // node-pg parses a DATE column into a Date unless you cast ::text. That
    // substitution is what caused the duplicates, and it produced no error —
    // so the guard has to be explicit.
    expect(() =>
      isDue({ ...base, lastSentDate: new Date("2026-08-16T00:00:00Z"), localHour: 19 })
    ).toThrow(/::text cast/);
  });

  it("accepts null, meaning never reminded", () => {
    expect(() => isDue({ ...base, lastSentDate: null, localHour: 18 })).not.toThrow();
  });
});

// Whether a stored push subscription is due for a reminder right now.
//
// Pure and separate from the route so it can be tested directly. This is where
// the duplicate-notification bug lived: the caller passed a JS Date where a
// "YYYY-MM-DD" string was expected, the already-reminded-today comparison could
// never be true, and every reminder fired twice — once at the chosen hour and
// again during the grace hour. Nothing failed loudly; it just nagged people.

// The grace hour exists because the scheduler is best-effort. If the run for
// the chosen hour is dropped or delayed past the hour boundary, the next run
// still catches it. It is safe ONLY because last_sent_date deduplicates —
// which is precisely what was broken.
export function isDue({ remindHour, lastSentDate, localDate, localHour }) {
  // Loud rather than silent. A Date here (node-pg's default parse of a DATE
  // column) would otherwise compare unequal to every date string forever, and
  // the only symptom would be users quietly getting two notifications.
  if (lastSentDate !== null && typeof lastSentDate !== "string") {
    throw new TypeError(
      `lastSentDate must be a "YYYY-MM-DD" string or null, got ${
        lastSentDate?.constructor?.name ?? typeof lastSentDate
      }. A pg DATE column needs an explicit ::text cast.`
    );
  }

  const inWindow =
    localHour === remindHour || localHour === (remindHour + 1) % 24;

  return inWindow && lastSentDate !== localDate;
}

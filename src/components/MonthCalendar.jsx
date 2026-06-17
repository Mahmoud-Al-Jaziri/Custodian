import { useMemo } from "react"

/**
 * Month calendar showing handoff history as envelope icons.
 *
 * States:
 *   - sealed:  a written handoff exists for that day
 *   - missed:  a day inside the user's active period that passed without
 *              a handoff — rendered as a subtle dot, not a ghost envelope,
 *              so a skipped night reads as "empty" rather than "failed"
 *   - future:  days the user hasn't reached yet — very faint outline
 *   - pre:     days before the user's first-ever handoff — rendered exactly
 *              like future days. The user can't have "missed" a day before
 *              they started; punishing pre-signup days contradicts the
 *              forgiving-streak philosophy in relayStreak.js
 *
 * If the user has no handoffs at all, every past day renders as `pre`
 * (neutral) — a brand-new user should see a calm, open month, not a
 * wall of misses.
 *
 * @param {Object} props
 * @param {Set<string>} props.writtenDates - Set of "YYYY-MM-DD" strings
 *                                            for days the user wrote.
 * @param {Date}        [props.month]      - Any date inside the month
 *                                            to display. Defaults to now.
 */
export default function MonthCalendar({ writtenDates, month = new Date() }) {

  // Build the cells for the displayed month
  const { monthLabel, cells } = useMemo(() => {
    const year      = month.getFullYear()
    const monthIdx  = month.getMonth()
    const firstDay  = new Date(year, monthIdx, 1)
    const daysInMon = new Date(year, monthIdx + 1, 0).getDate()

    // Today in LOCAL calendar form (matches relay_date format)
    const todayStr = new Date().toLocaleDateString("en-CA")

    // Earliest day the user ever wrote. "YYYY-MM-DD" strings sort
    // lexicographically in date order, so a plain min works.
    // null when the user has no handoffs yet.
    let firstWritten = null
    for (const d of writtenDates) {
      if (!firstWritten || d < firstWritten) firstWritten = d
    }

    // Mon=0 ... Sun=6 (we render Monday-first like the existing UI)
    const startWeekday = (firstDay.getDay() + 6) % 7

    const monthLabel = firstDay.toLocaleDateString(undefined, { month: "long" })

    const cells = []

    // Leading empty cells before day 1
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ key: `pad-${i}`, type: "empty" })
    }

    // Real days
    for (let d = 1; d <= daysInMon; d++) {
      const dateStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      const isFuture  = dateStr > todayStr
      const isWritten = writtenDates.has(dateStr)
      // A day only counts as "missed" once the user's relay has started.
      // Before firstWritten (or before any handoff exists at all) the day
      // is simply untracked.
      const isPre     = !firstWritten || dateStr < firstWritten

      let type
      if (isWritten)      type = "sealed"
      else if (isFuture)  type = "future"
      else if (isPre)     type = "pre"
      else                type = "missed"

      cells.push({ key: dateStr, type, day: d })
    }

    return { monthLabel, cells }
  }, [writtenDates, month])

  // SVG icon for each state — single source of truth
  const renderIcon = (type) => {
    if (type === "sealed") {
      return (
        <svg width="22" height="18" viewBox="0 0 40 32">
          <rect x="2" y="4" width="36" height="24" rx="2" fill="#BA7517"/>
          <path
            d="M2 6 L20 18 L38 6"
            stroke="#FAEEDA"
            strokeWidth="2"
            fill="none"
            strokeLinejoin="round"
          />
        </svg>
      )
    }

    if (type === "missed") {
      // Deliberately quiet: a small dot, not an empty envelope. A missed
      // night should read as a gap in the record, not a marked failure.
      return (
        <svg width="22" height="18" viewBox="0 0 40 32">
          <circle cx="20" cy="16" r="2.5" fill="#d6d3cb" />
        </svg>
      )
    }

    if (type === "future" || type === "pre") {
      return (
        <svg width="22" height="18" viewBox="0 0 40 32">
          <rect
            x="2" y="4" width="36" height="24" rx="2"
            fill="none"
            stroke="#ebe7dd"
            strokeWidth="1.2"
          />
          <path
            d="M3 6 L20 17 L37 6"
            stroke="#ebe7dd"
            strokeWidth="1"
            fill="none"
            strokeLinejoin="round"
          />
        </svg>
      )
    }

    return null // empty padding cell
  }

  const sealedCount = cells.filter(c => c.type === "sealed").length

  return (
    <div
      style={{
        background: "#fdfaf6",
        borderRadius: 18,
        padding: "20px 16px",
        border: "0.5px solid rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontFamily: "'Lora', Georgia, serif",
            fontStyle: "italic",
            fontSize: 16,
            color: "#1a1a18",
          }}
        >
          {monthLabel}
        </span>
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#9a9a94",
          }}
        >
          {sealedCount} sent
        </span>
      </div>

      {/* Weekday headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
          marginBottom: 8,
        }}
      >
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span
            key={i}
            style={{
              fontSize: 9,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#9a9a94",
              textAlign: "center",
            }}
          >
            {d}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
        }}
      >
        {cells.map(cell => (
          <div
            key={cell.key}
            title={cell.day ? `Day ${cell.day}` : undefined}
            style={{
              aspectRatio: "1 / 1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
              visibility: cell.type === "empty" ? "hidden" : "visible",
            }}
          >
            {renderIcon(cell.type)}
          </div>
        ))}
      </div>
    </div>
  )
}
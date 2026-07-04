import { useState, useEffect, useCallback } from "react"

const STEPS = [
  {
    target: "relay-score",
    title: "Your night streak",
    content: "Nights in a row you've passed the baton. Tonight's not done until evening, so it never breaks early — and you get a couple of rest nights so one slip won't reset you. Your best run is always kept.",
  },
  {
    target: "one-thing",
    title: "One thing forward",
    content: "This comes from what yesterday-you wrote for you. One small action to carry forward today.",
  },
  {
    target: "pomodoro",
    title: "Focus timer",
    content: "25 minutes of focus, 5 minutes of rest. Use it to actually do the one thing yesterday-you left you.",
  },
  {
    target: "write-handoff",
    title: "The most important button",
    content: "Every evening, press this. Write to tomorrow-you before you sleep. That's the whole app.",
  },
]

const TOOLTIP_W = 280
const PAD = 8 // breathing room between the target and its highlight ring
const GAP = 12 // space between the highlight and the tooltip

export default function AppTour({ run, onFinish }) {
  const [step, setStep] = useState(0)
  const [box, setBox] = useState(null)

  // Restart cleanly whenever the tour is (re)launched. State is adjusted
  // during render (guarded by prevRun) rather than in an effect — see
  // react.dev "You Might Not Need an Effect".
  const [prevRun, setPrevRun] = useState(run)
  if (run !== prevRun) {
    setPrevRun(run)
    if (run) {
      setStep(0)
      setBox(null)
    }
  }

  // Measure the current target in VIEWPORT coordinates. The page scrolls
  // inside .relay-main (the document itself never scrolls), so document
  // coordinates and window.scrollY are meaningless here. We jump the target
  // into view instantly and read its rect on the next frame — a smooth
  // scroll would hand us mid-animation positions.
  const measure = useCallback(() => {
    const el = document.getElementById(STEPS[step].target)
    if (!el) return
    el.scrollIntoView({ block: "center", behavior: "auto" })
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect()
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height })
    })
  }, [step])

  useEffect(() => {
    if (!run) return
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [run, measure])

  if (!run || !box) return null

  const isLast = step === STEPS.length - 1

  const next = () => {
    if (isLast) onFinish()
    else setStep(step + 1)
  }

  // Tooltip goes below the target when there's room, above it otherwise
  // (the last step highlights a button at the very bottom of the screen).
  const spaceBelow = window.innerHeight - (box.top + box.height + PAD)
  const vertical =
    spaceBelow >= 200
      ? { top: box.top + box.height + PAD + GAP }
      : { bottom: window.innerHeight - box.top + PAD + GAP }

  const tooltipLeft = Math.max(
    12,
    Math.min(
      box.left + box.width / 2 - TOOLTIP_W / 2,
      window.innerWidth - TOOLTIP_W - 12
    )
  )

  return (
    <>
      {/* Transparent click-catcher: any tap outside the tooltip ends the
          tour. The dimming itself comes from the cutout's shadow, so the
          highlighted element stays at full brightness. */}
      <div
        onClick={onFinish}
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
      />

      {/* Highlight cutout — the huge shadow dims everything around it. */}
      <div
        style={{
          position: "fixed",
          top: box.top - PAD,
          left: box.left - PAD,
          width: box.width + PAD * 2,
          height: box.height + PAD * 2,
          borderRadius: 12,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.45)",
          zIndex: 9999,
          pointerEvents: "none",
          transition:
            "top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease",
        }}
      />

      {/* Tooltip */}
      <div
        style={{
          position: "fixed",
          ...vertical,
          left: tooltipLeft,
          width: TOOLTIP_W,
          maxWidth: "calc(100vw - 24px)",
          backgroundColor: "#fff",
          borderRadius: 14,
          padding: "16px 20px",
          zIndex: 10000,
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.18)",
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: "#1a1a18" }}>
          {STEPS[step].title}
        </p>
        <p style={{ fontSize: 13, color: "#3a3a36", marginBottom: 16, lineHeight: 1.6 }}>
          {STEPS[step].content}
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            onClick={onFinish}
            style={{
              background: "none",
              border: "none",
              fontSize: 12,
              color: "#9a9a94",
              cursor: "pointer",
              padding: "10px 12px",
              margin: "-10px -12px",
            }}
          >
            Skip
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "#9a9a94" }}>
              {step + 1} / {STEPS.length}
            </span>
            <button
              onClick={next}
              style={{
                backgroundColor: "#BA7517",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 13,
                padding: "10px 18px",
                cursor: "pointer",
              }}
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

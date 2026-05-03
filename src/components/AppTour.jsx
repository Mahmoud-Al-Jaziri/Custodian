import { useState, useEffect } from "react"

const STEPS = [
  {
    target: "relay-score",
    title: "Your relay score",
    content: "This is not a streak. It's the percentage of days you've passed the baton. Missing one day doesn't reset everything — it just moves the number slightly.",
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

export default function AppTour({ run, onFinish }) {
  const [step, setStep] = useState(0)
  const [box, setBox] = useState(null)

  useEffect(() => {
    if (!run) return
    const el = document.getElementById(STEPS[step].target)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    const rect = el.getBoundingClientRect()
    setBox({
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    })
  }, [run, step])

  const finish = () => {
    localStorage.setItem("tourDone", "true")
    onFinish()
  }

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1)
    else finish()
  }

  if (!run || !box) return null

  const isLast = step === STEPS.length - 1
  const PADDING = 8
  const tooltipTop = box.top + box.height + PADDING + 12
  const tooltipLeft = Math.max(12, Math.min(box.left, window.innerWidth - 300 - 12))

  return (
    <>
      {/* Overlay */}
      <div
        onClick={finish}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.45)",
          zIndex: 9998,
        }}
      />

      {/* Highlight cutout */}
      <div
        style={{
          position: "absolute",
          top: box.top - PADDING,
          left: box.left - PADDING,
          width: box.width + PADDING * 2,
          height: box.height + PADDING * 2,
          borderRadius: 10,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
          zIndex: 9999,
          pointerEvents: "none",
        }}
      />

      {/* Tooltip */}
      <div
        style={{
          position: "absolute",
          top: tooltipTop,
          left: tooltipLeft,
          width: 280,
          backgroundColor: "#fff",
          borderRadius: 14,
          padding: "16px 20px",
          zIndex: 10000,
          boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: "#1a1a18" }}>
          {STEPS[step].title}
        </p>
        <p style={{ fontSize: 13, color: "#3a3a36", marginBottom: 16, lineHeight: 1.6 }}>
          {STEPS[step].content}
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={finish}
            style={{
              background: "none",
              border: "none",
              fontSize: 12,
              color: "#9a9a94",
              cursor: "pointer",
              padding: 0,
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
                borderRadius: 8,
                fontSize: 13,
                padding: "8px 16px",
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
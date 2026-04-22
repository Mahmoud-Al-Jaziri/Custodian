import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "react-bootstrap"

const SCREENS = [
  {
    label: "01 / 03",
    heading: "You are not the same person every day.",
    body: "Every morning you wake up as a slightly different version of yourself. Different energy, different mood, different priorities. This is why motivation fails — you're relying on a version of you that no longer exists."
  },
  {
    label: "02 / 03",
    heading: "Life is a relay race.",
    body: "Today-you holds the baton for a limited time. Your only job is to pass it forward in better shape than you received it. Not perfect. Just better. Tomorrow-you is counting on what you do right now."
  },
  {
    label: "03 / 03",
    heading: "You are now the custodian.",
    body: "Not a goal-setter. Not a habit-tracker. A custodian — someone who takes care of what they've been given and passes it forward. One note, one night, one version of you at a time."
  }
]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()

  const isLast = step === SCREENS.length - 1
  const screen = SCREENS[step]

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem("onboarded", "true")
      navigate("/login")
    } else {
      setStep(prev => prev + 1)
    }
  }

  return (
    <div className="relay-shell">
      <main
        className="relay-main px-4 d-flex flex-column justify-content-between"
        style={{ minHeight: "90dvh" }}
      >
        <div className="mt-4">
          <p className="screen-label mb-5">{screen.label}</p>

          <h1
            className="font-serif fst-italic mb-4"
            style={{ fontSize: 28, fontWeight: 400, lineHeight: 1.4 }}
          >
            {screen.heading}
          </h1>

          <p style={{ fontSize: 15, color: "#5a5a56", lineHeight: 1.8 }}>
            {screen.body}
          </p>
        </div>

        <div className="pb-4">
          <div className="d-flex gap-2 mb-4">
            {SCREENS.map((_, i) => (
              <div
                key={i}
                style={{
                  height: 3,
                  flex: 1,
                  borderRadius: 2,
                  background: i <= step ? "#BA7517" : "rgba(0,0,0,0.12)",
                  transition: "background 0.3s"
                }}
              />
            ))}
          </div>

          <Button
            className="btn-amber w-100 py-3 border-0"
            onClick={handleNext}
          >
            {isLast ? "Begin carrying →" : "Next →"}
          </Button>
        </div>
      </main>
    </div>
  )
}
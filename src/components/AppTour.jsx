import {Joyride} from "react-joyride"
import { useState, useEffect } from "react"

const STEPS = [
  {
    target: "#relay-score",
    title: "Your relay score",
    content:
      "This is not a streak. It's the percentage of days you've passed the baton. Missing one day doesn't reset everything — it just moves the number slightly.",
    disableBeacon: true,
  },
  {
    target: "#one-thing",
    title: "One thing forward",
    content:
      "This comes from what yesterday-you wrote for you. One small action to carry forward today.",
  },
  {
    target: "#pomodoro",
    title: "Focus timer",
    content:
      "25 minutes of focus, 5 minutes of rest. Use it to actually do the one thing yesterday-you left you.",
  },
  {
    target: "#write-handoff",
    title: "The most important button",
    content:
      "Every evening, press this. Write to tomorrow-you before you sleep. That's the whole app.",
  },
]

export default function AppTour({ run, onFinish }) {
  const [stepIndex, setStepIndex] = useState(0)

  // force restart properly when run becomes true
  useEffect(() => {
    if (run) {
      setStepIndex(0)
    }
  }, [run])

  const handleCallback = (data) => {
    const { status, index, type } = data

    // move to next step manually (controlled mode)
    if (type === "step:after") {
      setStepIndex(index + 1)
    }

    // finish detection
    if (status === "finished" || status === "skipped") {
      localStorage.setItem("tourDone", "true")
      onFinish()
    }
  }

  return (
    <Joyride
      steps={STEPS}
      run={run}
      stepIndex={stepIndex}   // 👈 THIS is the key fix
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      disableBeacon
      callback={handleCallback}
      styles={{
        options: {
          primaryColor: "#BA7517",
          textColor: "#1a1a18",
          backgroundColor: "#ffffff",
          arrowColor: "#ffffff",
          overlayColor: "rgba(0,0,0,0.45)",
          zIndex: 9999,
        },
        tooltip: {
          borderRadius: 14,
          fontSize: 13,
          padding: "16px 20px",
        },
        tooltipTitle: {
          fontSize: 14,
          fontWeight: 500,
          marginBottom: 6,
        },
        buttonNext: {
          backgroundColor: "#BA7517",
          borderRadius: 8,
          fontSize: 13,
          padding: "8px 16px",
        },
        buttonBack: {
          color: "#9a9a94",
          fontSize: 13,
        },
        buttonSkip: {
          color: "#9a9a94",
          fontSize: 12,
        },
      }}
    />
  )
}
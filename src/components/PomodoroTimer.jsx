import { useState, useEffect, useRef } from "react"
import { Card, Button } from "react-bootstrap"

// Matches the copy everywhere else (tour, README): 25 focus / 5 break.
const FOCUS_SECS = 25 * 60
const BREAK_SECS = 5 * 60

export default function PomodoroTimer() {
  const [isBreak, setIsBreak] = useState(false)
  const [running, setRunning] = useState(false)
  // Deadline-based countdown: `remaining` is derived from a wall-clock end
  // time on every tick, so background-tab throttling (which slows setInterval
  // to once a minute on mobile) can't drift the timer.
  const [remaining, setRemaining] = useState(FOCUS_SECS)
  const endAtRef = useRef(null)

  const playDing = () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()

    const frequencies = [523, 659, 784]

    frequencies.forEach((freq, i) => {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.3)

      gainNode.gain.setValueAtTime(0, ctx.currentTime + i * 0.3)
      gainNode.gain.linearRampToValueAtTime(0.4, ctx.currentTime + i * 0.3 + 0.05)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.3 + 0.6)

      oscillator.start(ctx.currentTime + i * 0.3)
      oscillator.stop(ctx.currentTime + i * 0.3 + 0.6)
    })
  }

  // While running, sync `remaining` with the deadline. Phase completion is
  // handled here in the tick callback (an external-system event), not in a
  // state-watching effect.
  useEffect(() => {
    if (!running) return

    const id = setInterval(() => {
      const left = Math.max(
        0,
        Math.round((endAtRef.current - Date.now()) / 1000)
      )
      setRemaining(left)

      if (left === 0) {
        clearInterval(id)
        setRunning(false)
        const nextIsBreak = !isBreak
        setIsBreak(nextIsBreak)
        setRemaining(nextIsBreak ? BREAK_SECS : FOCUS_SECS)
        playDing()
      }
    }, 250)

    return () => clearInterval(id)
  }, [running, isBreak])

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0")
    const s = (seconds % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  const toggle = () => {
    if (running) {
      // Capture the exact remainder so pausing doesn't lose a partial second.
      setRemaining(
        Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000))
      )
      setRunning(false)
    } else {
      endAtRef.current = Date.now() + remaining * 1000
      setRunning(true)
    }
  }

  const resetTimer = () => {
    setRunning(false)
    setIsBreak(false)
    setRemaining(FOCUS_SECS)
  }

  const handleSkip = () => {
    setRunning(false)
    const nextIsBreak = !isBreak
    setIsBreak(nextIsBreak)
    setRemaining(nextIsBreak ? BREAK_SECS : FOCUS_SECS)
    playDing()
  }

  return (
    <Card className="one-thing-card mb-3">
      <Card.Body className="p-3 text-center">
        <p className="screen-label mb-1">
          {isBreak ? "break time" : "focus time"}
        </p>

        <p
          className="font-serif mb-2"
          style={{
            fontSize: 42,
            fontWeight: 300,
            lineHeight: 1,
            letterSpacing: "0.05em"
          }}
        >
          {formatTime(remaining)}
        </p>

        <div className="d-flex justify-content-center gap-2">
          <Button
            className="btn-amber border-0 px-4"
            style={{ fontSize: 13 }}
            onClick={toggle}
          >
            {running ? "pause" : "start"}
          </Button>

          <Button
            variant="outline-secondary"
            className="px-3"
            style={{ fontSize: 13 }}
            onClick={resetTimer}
          >
            reset
          </Button>

          <Button
            variant="outline-secondary"
            className="px-3"
            style={{ fontSize: 13 }}
            onClick={handleSkip}
          >
            skip
          </Button>
        </div>
      </Card.Body>
    </Card>
  )
}

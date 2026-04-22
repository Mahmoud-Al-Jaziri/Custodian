import { useState, useEffect, useRef } from "react"
import { Card, Button } from "react-bootstrap"

export default function PomodoroTimer() {
  const [timerRunning, setTimerRunning] = useState(false)
  const [timeLeft, setTimeLeft] = useState(20 * 60)
  const [isBreak, setIsBreak] = useState(false)
  const intervalRef = useRef(null)
  const audioCtxRef = useRef(null)

  const playDing = () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    audioCtxRef.current = ctx

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

  // interval: ONLY handles countdown
  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1)
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }

    return () => clearInterval(intervalRef.current)
  }, [timerRunning])

  // handle when timer reaches 0
  useEffect(() => {
    if (timeLeft !== 0) return

    clearInterval(intervalRef.current)
    setTimerRunning(false)

    setIsBreak(prev => {
      const next = !prev
      setTimeLeft(next ? 5 * 60 : 20 * 60)
      return next
    })

    playDing()
  }, [timeLeft])

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0")
    const s = (seconds % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  const resetTimer = () => {
    clearInterval(intervalRef.current)
    setTimerRunning(false)
    setIsBreak(false)
    setTimeLeft(20 * 60)
  }

  const handleSkip = () => {
    clearInterval(intervalRef.current)
    setTimerRunning(false)

    setIsBreak(prev => {
      const next = !prev
      setTimeLeft(next ? 5 * 60 : 20 * 60)
      return next
    })

    playDing()
  }

  return (
    <Card className="one-thing-card border-0 mb-3">
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
          {formatTime(timeLeft)}
        </p>

        <div className="d-flex justify-content-center gap-2">
          <Button
            className="btn-amber border-0 px-4"
            style={{ fontSize: 13 }}
            onClick={() => setTimerRunning(prev => !prev)}
          >
            {timerRunning ? "pause" : "start"}
          </Button>

          <Button
            variant="outline-secondary"
            className="px-3"
            style={{ fontSize: 13, borderColor: "rgba(0,0,0,0.15)" }}
            onClick={resetTimer}
          >
            reset
          </Button>

          <Button
            variant="outline-secondary"
            className="px-3"
            style={{ fontSize: 13, borderColor: "rgba(0,0,0,0.15)" }}
            onClick={handleSkip}
          >
            skip
          </Button>
        </div>
      </Card.Body>
    </Card>
  )
}
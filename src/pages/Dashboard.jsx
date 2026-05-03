import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button, Card, Spinner } from "react-bootstrap"
import PageShell from "../components/Pageshell.jsx"
import RelayScore from "../components/Relayscore.jsx"
import { getAllHandoffs } from "../services/handoffs.js"
import { useAuth } from "../context/AuthContext.jsx"
import PomodoroTimer from "../components/PomodoroTimer.jsx"
import AppTour from "../components/AppTour.jsx"

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [handoffs, setHandoffs] = useState([])
  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState(0)
  const [history, setHistory] = useState([
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ])
  const [oneThing, setOneThing] = useState(null)
  const [dayCount, setDayCount] = useState(0)

  const [runTour, setRunTour] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getAllHandoffs(user.uid)
        setHandoffs(data)

        const signupDate = new Date(user.metadata.creationTime)
        const today = new Date()

        const totalDays = Math.max(
          1,
          Math.floor((today - signupDate) / (1000 * 60 * 60 * 24)) + 1
        )

        const uniqueHandoffDays = new Set(
          data.map((h) => h.relay_date?.slice(0, 10))
        ).size

        const relayScore = Math.round(
          (uniqueHandoffDays / totalDays) * 100
        )

        setScore(relayScore)
        setDayCount(uniqueHandoffDays)

        const last7 = Array.from({ length: 7 }, (_, i) => {
          const d = new Date()
          d.setDate(d.getDate() - i)
          return d.toLocaleDateString("en-CA")
        }).reverse()

        const history7 = last7.map((date) =>
          data.some((h) => h.relay_date?.slice(0, 10) === date)
        )

        setHistory(history7)

        const latest = data[0]
        if (latest?.one_thing) setOneThing(latest.one_thing)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    if (user) fetchData()
  }, [user])

  useEffect(() => {
    if (!loading) {
      const hasDoneTour = localStorage.getItem("tourDone") === "true"

      if (!hasDoneTour) {
        const timer = setTimeout(() => {
          setRunTour(true)
        }, 300)

        return () => clearTimeout(timer)
      }
    }
  }, [loading])

  if (loading)
    return (
      <PageShell>
        <div className="d-flex justify-content-center mt-5">
          <Spinner animation="border" size="sm" />
        </div>
      </PageShell>
    )

  return (
    <>
      <AppTour run={runTour} onFinish={() => setRunTour(false)} />

      <PageShell>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div
            style={{
              fontSize: 16,
              fontWeight: 500,
              letterSpacing: "0.04em",
            }}
          >
            Relay<span className="text-amber">.</span>
          </div>
          <span className="day-badge">
            {dayCount} {dayCount === 1 ? "day" : "days"} of carrying
          </span>
        </div>

        <div id="relay-score">
          <RelayScore score={score} history={history} />
        </div>

        <Card id="one-thing" className="one-thing-card border-0 mb-3">
          <Card.Body className="p-3">
            <p className="screen-label text-amber mb-2">
              Your one thing today
            </p>

            {oneThing ? (
              <p
                className="font-serif fst-italic mb-0"
                style={{ fontSize: 14, lineHeight: 1.6 }}
              >
                "{oneThing}"
              </p>
            ) : (
              <p
                className="mb-0"
                style={{
                  fontSize: 13,
                  color: "#9a9a94",
                  fontStyle: "italic",
                }}
              >
                Yesterday-you didn't leave a one thing. Set one tonight.
              </p>
            )}
          </Card.Body>
        </Card>

        <div id="pomodoro">
          <PomodoroTimer />
        </div>

        <Card className="one-thing-card border-0 mb-3">
          <Card.Body className="p-3 text-center">
            <p
              className="font-serif mb-0"
              style={{
                fontSize: 14,
                lineHeight: 1.7,
                color: "#6f6f69",
                fontStyle: "italic",
              }}
            >
              You will <b>not win</b> today.<br />
              You will <b>not see</b> the result.<br />
              Play well anyway.<br />
              The next version of you inherits this.
            </p>
          </Card.Body>
        </Card>

        <Button
          id="write-handoff"
          className="btn-amber w-100 py-3 border-0"
          onClick={() => navigate("/evening")}
        >
          WRITE TONIGHT'S HANDOFF
        </Button>
      </PageShell>
    </>
  )
}
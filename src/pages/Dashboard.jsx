import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card } from "react-bootstrap";
import { DashboardSkeleton } from "../components/Skeleton.jsx";
import PageShell from "../components/Pageshell.jsx";
import RelayScore from "../components/Relayscore.jsx";
import { getHandoffSummaries } from "../services/handoffs.js";
import { computeRelayStreak } from "../utils/relayStreak.js";
import { useAuth } from "../context/useAuth.js";
import PomodoroTimer from "../components/PomodoroTimer.jsx";
import AppTour from "../components/AppTour.jsx";
import ReminderCard from "../components/ReminderCard.jsx";

const LAST_VISIT_KEY = "lastVisit";
const PROMPT_DISMISSED_KEY = "upgradePromptDismissedAt";

// Pick a contextual upgrade message based on engagement.
// Returns null if there's no point nagging right now.
function chooseUpgradeMessage({ isGuest, handoffCount, daysSinceLastVisit }) {
  if (!isGuest) return null;

  // Quietly dismissed within the last 3 days? Don't re-show.
  const dismissedAt = Number(localStorage.getItem(PROMPT_DISMISSED_KEY) || 0);
  if (dismissedAt && Date.now() - dismissedAt < 1000 * 60 * 60 * 24 * 3) {
    return null;
  }

  if (handoffCount >= 7) {
    return {
      tone: "high",
      text: `${handoffCount} batons carried in this browser. One email link locks them in forever.`,
    };
  }
  if (daysSinceLastVisit >= 1 && handoffCount > 0) {
    return {
      tone: "medium",
      text: "Welcome back. Sign in to keep tomorrow-you safe across devices.",
    };
  }
  if (handoffCount >= 3) {
    return {
      tone: "medium",
      text: `You've passed ${handoffCount} batons. Want them to follow you between devices?`,
    };
  }
  if (handoffCount === 0) {
    return null; // nothing to lose yet — don't push
  }
  return {
    tone: "low",
    text: "Your handoffs live in this browser. Sign in to back them up.",
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const isGuest = !user;

  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(null);
  const [handoffs, setHandoffs] = useState([]);
  const [oneThing, setOneThing] = useState(null);
  const [dayCount, setDayCount] = useState(0);
  const [runTour, setRunTour] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState(null);

  // Track "last visit" so we can show a returning-user prompt
  const [daysSinceLastVisit, setDaysSinceLastVisit] = useState(0);
  useEffect(() => {
    const prev = localStorage.getItem(LAST_VISIT_KEY);
    if (prev) {
      const diff = Math.floor(
        (Date.now() - new Date(prev).getTime()) / (1000 * 60 * 60 * 24)
      );
      setDaysSinceLastVisit(diff);
    }
    localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
  }, []);

  useEffect(() => {
    if (authLoading) return;

    async function fetchData() {
      try {
        // Summaries (id/relay_date/one_thing) are all this page needs —
        // the full notes never render here.
        const data = await getHandoffSummaries();
        setHandoffs(data);

        // Forgiving night-streak — replaces the old lifetime percentage, which
        // punished early misses forever and could exceed 100% from a unit bug.
        const streak = computeRelayStreak(data);
        setStreak(streak);
        setDayCount(streak.totalDays);

        // "Your one thing today" is what YESTERDAY-you left — the most recent
        // handoff before today. data[0] would show tonight's own instruction
        // right after you write it, which is meant for tomorrow.
        const todayStr = new Date().toLocaleDateString("en-CA");
        const fromYesterday = data.find((h) => h.relay_date < todayStr);
        if (fromYesterday?.one_thing) setOneThing(fromYesterday.one_thing);

        // Decide what to show (if anything) for the upgrade prompt
        setUpgradeMsg(
          chooseUpgradeMessage({
            isGuest,
            handoffCount: data.length,
            daysSinceLastVisit,
          })
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [authLoading, user, isGuest, daysSinceLastVisit]);

  useEffect(() => {
    if (loading) return;
    const tourKey = `tourDone_${user?.uid || "guest"}`;
    if (!localStorage.getItem(tourKey)) {
      setTimeout(() => setRunTour(true), 500);
    }
  }, [loading, user]);

  const dismissUpgrade = () => {
    localStorage.setItem(PROMPT_DISMISSED_KEY, String(Date.now()));
    setUpgradeMsg(null);
  };

  if (loading) {
    return (
      <PageShell>
        <DashboardSkeleton />
      </PageShell>
    );
  }

  return (
    <>
      <AppTour
        run={runTour}
        onFinish={() => {
          const tourKey = `tourDone_${user?.uid || "guest"}`;
          localStorage.setItem(tourKey, "true");
          setRunTour(false);
        }}
      />
      <PageShell>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div
            style={{
              fontSize: 16,
              fontWeight: 500,
              letterSpacing: "0.04em",
            }}
          >
            Custodian<span className="text-amber">.</span>
          </div>
          <span className="day-badge">
            {dayCount} {dayCount === 1 ? "day" : "days"} of carrying
          </span>
        </div>

        {upgradeMsg && (
          <div
            className="mb-3 p-3"
            style={{
              background:
                upgradeMsg.tone === "high" ? "#F5DBA5" : "#FAEEDA",
              borderRadius: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <p
              className="mb-0"
              style={{
                fontSize: 12,
                color: "#633806",
                lineHeight: 1.5,
                flex: 1,
              }}
            >
              {upgradeMsg.text}
            </p>
            <div className="d-flex flex-column gap-1 flex-shrink-0">
              <Button
                size="sm"
                className="btn-amber border-0"
                onClick={() => navigate("/login")}
                style={{ fontSize: 11, whiteSpace: "nowrap" }}
              >
                Save relay →
              </Button>
              <Button
                size="sm"
                variant="link"
                onClick={dismissUpgrade}
                style={{
                  fontSize: 10,
                  color: "#9a7548",
                  textDecoration: "none",
                  padding: 0,
                }}
              >
                Not now
              </Button>
            </div>
          </div>
        )}

        <div id="relay-score">
          {streak && <RelayScore {...streak} handoffs={handoffs} />}
        </div>

        {oneThing ? (
          <Card id="one-thing" className="one-thing-card mb-3">
            <Card.Body className="p-3">
              <p className="screen-label text-amber mb-2">
                Your one thing today
              </p>
              <p
                className="font-serif fst-italic mb-0"
                style={{ fontSize: 14, lineHeight: 1.6 }}
              >
                "{oneThing}"
              </p>
            </Card.Body>
          </Card>
        ) : (
          <Card id="one-thing" className="one-thing-card mb-3">
            <Card.Body className="p-3">
              <p className="screen-label text-amber mb-2">
                Your one thing today
              </p>
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
            </Card.Body>
          </Card>
        )}

        <div id="pomodoro">
          <PomodoroTimer />
        </div>

        <ReminderCard />

        <Card className="one-thing-card mb-3">
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
              You will{" "}
              <span
                style={{ color: "#000", fontStyle: "normal", fontWeight: 500 }}
              >
                not win
              </span>{" "}
              today.
              <br />
              You will{" "}
              <span
                style={{ color: "#000", fontStyle: "normal", fontWeight: 500 }}
              >
                not see
              </span>{" "}
              the result.
              <br />
              Play well anyway.
              <br />
              <span>The next version of you inherits this.</span>
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
  );
}
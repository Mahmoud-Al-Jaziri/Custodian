import { Button, Stack } from "react-bootstrap";
import { LetterSkeleton } from "../components/Skeleton.jsx";
import PageShell from "../components/Pageshell";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import LetterCard from "../components/LetterCard";
import { getLatestHandoff, getAllHandoffs } from "../services/handoffs";
import { useAuth } from "../context/useAuth";
import HistoryOffcanvas from "../components/HistoryOffcanvas";

// Resolve an image URL from either a cloud `image_url` field or a local Blob.
function useAttachmentUrl(handoff) {
  return useMemo(() => {
    if (!handoff) return null;
    if (handoff.image_url) return handoff.image_url;
    if (handoff.attachment instanceof Blob) {
      return URL.createObjectURL(handoff.attachment);
    }
    return null;
  }, [handoff]);
}

export default function Morning() {
  const { user, loading: authLoading } = useAuth();
  const [handoff, setHandoff] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const attachmentUrl = useAttachmentUrl(handoff);

  // Revoke object URLs when the handoff changes or we unmount.
  useEffect(() => {
    return () => {
      if (attachmentUrl?.startsWith?.("blob:")) {
        URL.revokeObjectURL(attachmentUrl);
      }
    };
  }, [attachmentUrl]);

  const now = new Date();
  // Use the device locale — the app isn't Malaysia-specific.
  const timeStr = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    if (authLoading) return;
    async function fetchHandoff() {
      try {
        const data = await getLatestHandoff();
        setHandoff(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchHandoff();
  }, [authLoading, user]);

  const handleShowHistory = async () => {
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      // Server-side LIMIT — don't ship the whole archive for a 7-item sheet.
      const data = await getAllHandoffs(7);
      setHistory(data);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Both cloud (`created_at`) and local (`created_at` or `updated_at`) records
  // include a timestamp; coerce safely.
  const timestamp = handoff?.created_at
    ? new Date(handoff.created_at).toLocaleString()
    : null;

  return (
    <PageShell>
      <p className="screen-label mb-3">Morning</p>
      <div
        style={{ fontSize: 42, fontWeight: 300, lineHeight: 1 }}
        className="mb-1"
      >
        {timeStr}
      </div>
      <p style={{ fontSize: 12, color: "#9a9a94" }} className="mb-4">
        {dateStr}
      </p>

      {loading ? (
        <LetterSkeleton />
      ) : handoff ? (
        <LetterCard
          note={handoff.note}
          timestamp={timestamp}
          imageUrl={attachmentUrl}
        />
      ) : (
        <p style={{ fontSize: 13, color: "#9a9a94", fontStyle: "italic" }}>
          Yesterday's you didn't leave a note. Start fresh.
        </p>
      )}

      <Stack gap={2} className="mt-3">
        <Button
          className="btn-amber w-100 py-3 border-0"
          onClick={() => navigate("/dashboard")}
        >
          START TODAY'S RELAY →
        </Button>

        <Button
          variant="outline-secondary"
          size="sm"
          className="rounded-pill px-3 my-3"
          onClick={handleShowHistory}
        >
          📜 Read last week's notes
        </Button>

        <HistoryOffcanvas
          show={showHistory}
          onHide={() => setShowHistory(false)}
          history={history}
          historyLoading={historyLoading}
        />
      </Stack>
    </PageShell>
  );
}

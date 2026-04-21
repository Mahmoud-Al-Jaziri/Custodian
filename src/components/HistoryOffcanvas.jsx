import { Offcanvas, Spinner, Badge } from "react-bootstrap"
import LetterCard from "./LetterCard.jsx"

export default function HistoryOffcanvas({ show, onHide, history, historyLoading }) {
  return (
    <Offcanvas
      show={show}
      onHide={onHide}
      placement="bottom"
      style={{
        height: "75dvh",
        borderRadius: "24px 24px 0 0",
        background: "linear-gradient(180deg, #fdfaf6 0%, #f7f3ee 100%)",
        border: "none",
      }}
    >
      <Offcanvas.Header
        closeButton
        style={{
          borderBottom: "1px solid rgba(0,0,0,0.05)",
          paddingBottom: 12,
        }}
      >
        <Offcanvas.Title
          className="font-serif fst-italic w-100 text-center"
          style={{
            fontSize: 18,
            fontWeight: 400,
            letterSpacing: "0.5px",
          }}
        >
          Last week's relay
        </Offcanvas.Title>
      </Offcanvas.Header>

      <Offcanvas.Body
        style={{
          overflowY: "auto",
          display: "flex",
          justifyContent: "center",
        }}
      >
        {/* CENTER CONTAINER */}
        <div style={{ width: "100%", maxWidth: 520 }}>
          {historyLoading ? (
            <div className="d-flex justify-content-center mt-4">
              <Spinner animation="border" size="sm" />
            </div>
          ) : history.length === 0 ? (
            <p
              style={{
                fontSize: 13,
                color: "#9a9a94",
                fontStyle: "italic",
                textAlign: "center",
                marginTop: 20,
              }}
            >
              No past handoffs yet. Start tonight.
            </p>
          ) : (
            history.map((h, i) => (
              <div
                key={h.id}
                className="mb-4"
                style={{
                  padding: "12px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.6)",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
                }}
              >
                <div className="d-flex align-items-center gap-2 mb-2">
                  <Badge
                    bg={null}
                    style={{
                      background: "#FAEEDA",
                      color: "#854F0B",
                      fontSize: 10,
                      fontWeight: 400,
                      borderRadius: 20,
                      padding: "4px 10px",
                    }}
                  >
                    {new Date(h.relay_date).toLocaleDateString("en-MY", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </Badge>

                  {i === 0 && (
                    <Badge
                      bg={null}
                      style={{
                        background: "#E1F5EE",
                        color: "#085041",
                        fontSize: 10,
                        fontWeight: 400,
                        borderRadius: 20,
                        padding: "4px 10px",
                      }}
                    >
                      most recent
                    </Badge>
                  )}
                </div>

                <LetterCard
                  note={h.note}
                  timestamp={new Date(h.created_at).toLocaleString()}
                  imageUrl={h.image_url}
                  from="past you"
                />
              </div>
            ))
          )}
        </div>
      </Offcanvas.Body>
    </Offcanvas>
  )
}
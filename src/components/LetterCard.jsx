import { Card } from "react-bootstrap";

export default function LetterCard({
  note,
  timestamp,
  from = "yesterday's you",
  imageUrl
})
 {
  const isPdf = imageUrl?.toLowerCase().includes(".pdf")
  return (
    <Card className="letter-card border-0 border-amber-left mb-3">
      <Card.Body className="p-3">
        <p className="screen-label text-amber-dark mb-2">
          From {from}
        </p>

        {note && (
          <p
            className="font-serif fst-italic mb-0"
            style={{ fontSize: 14, lineHeight: 1.7 }}
          >
            "{note}"
          </p>
        )}
        
        {imageUrl && (
          <div className="mt-3">
            {isPdf ? (
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 12,
                  color: "#BA7517",
                  textDecoration: "none",
                  display: "inline-block",
                  background: "#FAEEDA",
                  padding: "6px 12px",
                  borderRadius: 8
                }}
              >
                Open attachment →
              </a>
            ) : (
              <img
                src={imageUrl}
                alt="attachment from yesterday-you"
                style={{
                  width: "100%",
                  borderRadius: 10,
                  objectFit: "cover",
                  maxHeight: 200
                }}
              />
            )}
          </div>
        )}

        {timestamp && (
          <p className="mt-2 mb-0" style={{ fontSize: 10, color: "#9a9a94" }}>
            {timestamp}
          </p>
        )}
      </Card.Body>
    </Card>
  );
}
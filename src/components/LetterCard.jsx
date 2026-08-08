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
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap", // honor the line breaks the user typed
            }}
          >
            {"\u201C" + note + "\u201D"}
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
                // The history sheet stacks seven of these. Without lazy, opening
                // it downloads every attachment at once — most of them below the
                // fold and never actually looked at.
                loading="lazy"
                decoding="async"
                style={{
                  width: "100%",
                  borderRadius: 10,
                  objectFit: "contain",
                  maxHeight: 300,
                  background: "#f6f4ef"
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
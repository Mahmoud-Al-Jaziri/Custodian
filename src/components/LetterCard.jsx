import { Card } from "react-bootstrap";

export default function LetterCard({
  note,
  timestamp,
  from = "yesterday's you",
  imageUrl
})
 {
  // Which attachments get a link instead of an <img>. The picker accepts Word
  // documents too, and they used to fall through to the image branch and
  // render as a small broken icon — with the reserved 4:3 box that became a
  // full-width empty panel, so this is no longer merely untidy.
  //
  // Tested for documents rather than images on purpose: guests pass a
  // blob: URL with no extension at all, and those are always images.
  const isDocument = /\.(pdf|docx?)(\?|$)/i.test(imageUrl ?? "")
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
            {isDocument ? (
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
                // The history sheet stacks seven of these, and we don't want to
                // fetch the ones below the fold. loading="lazy" alone does NOT
                // achieve that: an <img> with no dimensions is 0px tall until it
                // loads, so all seven collapse into a stack shorter than the
                // viewport, the browser decides every one is visible, and
                // fetches the lot. aspect-ratio reserves the box up front, which
                // is what makes the deferral real — and removes the layout shift
                // as each image pops in. Don't drop it thinking it's cosmetic.
                loading="lazy"
                decoding="async"
                style={{
                  width: "100%",
                  aspectRatio: "4 / 3",
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
import { Card } from 'react-bootstrap'

export default function RelayScore({score,history = [true, true, true, false, true, true, true]}){

    return(
        <Card className="score-ring-wrap border-0 mb-3">
      <Card.Body className="p-3 d-flex align-items-center gap-3">
        <div className="flex-shrink-0">
          <div style={{ fontSize: 34, fontWeight: 300, lineHeight: 1 }}>
            {score}<span style={{ fontSize: 16, color: '#9a9a94' }}>%</span>
          </div>
          <p className="screen-label mb-0 mt-1">relay score</p>
        </div>
        <div className="d-flex align-items-end gap-1 flex-grow-1" style={{ height: 36 }}>
          {history.map((filled, i) => (
            <div
              key={i}
              className="score-bar"
              style={{
                height: filled ? "100%" : "30%",
                backgroundColor: filled ? 'var(--amber)' : 'var(--amber-mid)',
                opacity: filled ? 1 : 0.35,
              }}
            />
          ))}
        </div>
      </Card.Body>
    </Card>
    )
}
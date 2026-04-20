import { useNavigate } from "react-router-dom";
import PageShell from "../components/Pageshell"
import RelayScore from "../components/Relayscore"
import { Button, Card } from "react-bootstrap";
import { signOut } from "firebase/auth"
import {auth} from "../firebase"


const STATIC_ONE_THING = "Close the proposal and send it — yesterday-you earned this finish line.";

export default function Dashboard(){
    const navigate = useNavigate;

    return(
        <PageShell>
            <div  className="d-flex justify-content-between align-items-center mb-4">
                <div style={{ fontSize: 16, fontWeight: 500, letterSpacing: '0.04em' }}>
                    Relay<span className="text-amber">.</span>
                </div>
                <span className="day-badge">Day 7 of carrying</span>
            </div>

            <RelayScore score={71} history={[true, true, true, false, true, true, true]}/>

            <Card className="one-thing-card border-0 mb-3">
                <Card.Body className="p-3">
                <p className="screen-label text-amber mb-2">Your one thing today</p>
                <p className="font-serif fst-italic mb-0" style={{ fontSize: 14, lineHeight: 1.6 }}>
                    "{STATIC_ONE_THING}"
                </p>
                </Card.Body>
            </Card>

            <Button
                variant="outline-secondary"
                className="w-100 py-3"
                style={{ fontSize: 14, borderColor: 'rgba(0,0,0,0.15)' }}
                onClick={() => navigate('/evening')}
            >
                Write tonight's handoff
            </Button>
            <button onClick={() => signOut(auth)}>Logout</button>
        </PageShell>
    )
}
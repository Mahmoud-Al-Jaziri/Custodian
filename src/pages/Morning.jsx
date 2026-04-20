import { Button, Stack, Spinner } from "react-bootstrap";
import PageShell from "../components/Pageshell";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import LetterCard from "../components/LetterCard";
import { getLatestHandoff } from "../services/handoffs";
import { useAuth } from "../context/AuthContext";


export default function Morning (){
    const {user} = useAuth()
    const [handoff, setHandoff] = useState(null)
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-MY',{hour: '2-digit', minute:'2-digit',hour12: false});
    const dateStr = now.toLocaleDateString('en-MY',{weekday: 'long', month: 'long', day:'numeric'});

    useEffect(()=>{
        async function fetchHandoff(){
            try{
                const data = await getLatestHandoff(user.uid);
                setHandoff(data);
            }catch(err){
                console.error(err);
            }finally{
                setLoading(false)
            }
        }
        if(user) fetchHandoff()
    },[user])
    
    return (
        <PageShell>
        <p className="screen-label mb-3">Morning</p>
        <div style={{ fontSize: 42, fontWeight: 300, lineHeight: 1 }} className="mb-1">{timeStr}</div>
        <p style={{ fontSize: 12, color: "#9a9a94" }} className="mb-4">{dateStr}</p>

        {loading ? (
            <Spinner animation="border" size="sm" />
        ) : handoff ? (
            <LetterCard note={handoff.note} timestamp={new Date(handoff.created_at).toLocaleString()} imageUrl={handoff.image_url} />
        ) : (
            <p style={{ fontSize: 13, color: "#9a9a94", fontStyle: "italic" }}>
            Yesterday's you didn't leave a note. Start fresh.
            </p>
        )}

        <Stack gap={2} className="mt-3">
            <Button className="btn-amber w-100 py-3 border-0" onClick={() => navigate("/dashboard")}>
            Start today's relay →
            </Button>
            <Button variant="link" className="text-secondary text-decoration-none" style={{ fontSize: 12 }}>
            Read last week's notes
            </Button>
        </Stack>
        </PageShell>
  )
}
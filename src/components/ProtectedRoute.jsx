import { useAuth } from "../context/AuthContext";
import { Spinner } from "react-bootstrap";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({children}){
    const { user,loading }= useAuth();
    
    if(loading) return <Spinner animation="border"/>

    if(!user) return <Navigate to={"/login"}/>

    return(
        children
    )
}
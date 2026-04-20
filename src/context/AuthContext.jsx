import { createContext, useContext} from "react";
import { onAuthStateChanged} from "firebase/auth";
import { useState, useEffect } from "react";
import {auth} from "../firebase";

export  const  AuthContext =  createContext();

export function useAuth(){
        return useContext(AuthContext)
    };

export default function  UserAuthProvider({children}){
    
    const [user,setUser] = useState(null);
    const [loading,setLoading] = useState(true);

    useEffect(()=>{
        const unsubscribe = onAuthStateChanged(auth,(user)=>{
            
            if(user){
                setUser(user)
                
            }else{
                //user signed out
                setUser(null)
            }
            setLoading(false)
        })
        //The return inside useEffect is React's cleanup mechanism — it runs automatically when the component is destroyed.
        return ()=> unsubscribe()
    },[])

    return(
        <AuthContext.Provider value={{user,loading}}>
            {children}
        </AuthContext.Provider>
    )
}
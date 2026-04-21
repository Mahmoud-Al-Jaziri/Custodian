import { Navbar, Nav, Button } from "react-bootstrap";
import { useNavigate, useLocation } from "react-router-dom";
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'

export default function NavBar(){
    const NAV_ITEMS = [
        { path: '/morning',   label: 'morning'  },
        { path: '/dashboard', label: 'relay'    },
        { path: '/evening',   label: 'evening'  },
    ]
    const {pathname} = useLocation();
    const navigate = useNavigate();

    const handleLogout = async () => {
    try {
      await signOut(auth)
      navigate('/login')
    } catch (err) {
      console.error(err)
    }
  }

    return(
        <Nav className="relay-nav justify-content-around py-2">
            {NAV_ITEMS.map(({path,label})=>(
                <Nav.Link 
                    key={path}
                    className={pathname === path ? 'active text-center' : 'text-center'}
                    onClick={()=>navigate(path)}
                >
                    <span className="nav-dot"/>
                    {label}
                </Nav.Link>
            ))}
            <Button
                variant="link"
                onClick={handleLogout}
                className="logout-btn d-flex flex-column align-items-center p-0"
                >
                <span
                    className="material-symbols-outlined logout-icon"
                    
                >
                    logout
                </span>
                exit
            </Button>
        </Nav>    
    )
}
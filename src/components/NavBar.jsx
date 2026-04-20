import { Navbar, Nav } from "react-bootstrap";
import { useNavigate, useLocation } from "react-router-dom";

export default function NavBar(){
    const NAV_ITEMS = [
        { path: '/morning',   label: 'morning'  },
        { path: '/dashboard', label: 'relay'    },
        { path: '/evening',   label: 'evening'  },
    ]
    const {pathname} = useLocation();
    const navigate = useNavigate();

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
        </Nav>    
    )
}
import { Nav } from "react-bootstrap";
import { useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { path: "/morning", label: "morning", icon: "wb_twilight" },
  { path: "/dashboard", label: "today", icon: "today" },
  { path: "/evening", label: "evening", icon: "bedtime", id: "nav-evening" },
];

export default function NavBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  // Local-first guest mode: no Firebase user at all means guest. (The old
  // check for user.isAnonymous predates the removal of anonymous auth and
  // never matched, so guests were shown "exit" instead of "save".)
  const isGuest = !user;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Nav as="nav" aria-label="Primary" className="relay-nav justify-content-around">
      {NAV_ITEMS.map(({ path, label, icon, id }) => (
        <Nav.Link
          key={path}
          id={id}
          aria-current={pathname === path ? "page" : undefined}
          className={pathname === path ? "active" : ""}
          onClick={() => navigate(path)}
        >
          <span className="material-symbols-outlined nav-icon" aria-hidden="true">
            {icon}
          </span>
          {label}
        </Nav.Link>
      ))}

      {isGuest ? (
        // Guest — logging out would strand their local data, so offer save.
        <Nav.Link onClick={() => navigate("/login")}>
          <span className="material-symbols-outlined nav-icon" aria-hidden="true">
            bookmark
          </span>
          save
        </Nav.Link>
      ) : (
        <Nav.Link onClick={handleLogout}>
          <span className="material-symbols-outlined nav-icon" aria-hidden="true">
            logout
          </span>
          exit
        </Nav.Link>
      )}
    </Nav>
  );
}

import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

export default function NavBar() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="nav">
      <div className="container row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          <strong style={{ marginRight: 12 }}>WesternPumps</strong>
          {isAuthenticated && (
            <>
              <NavLink to="/customers" className={({ isActive }) => (isActive ? "active" : "")}>
                Customers
              </NavLink>
              <NavLink to="/jobs" className={({ isActive }) => (isActive ? "active" : "")}>
                Jobs
              </NavLink>
              <NavLink to="/inventory" className={({ isActive }) => (isActive ? "active" : "")}>
                Inventory
              </NavLink>
              <NavLink to="/suppliers" className={({ isActive }) => (isActive ? "active" : "")}>
                Suppliers
              </NavLink>
            </>
          )}
        </div>
        <div>
          {isAuthenticated ? (
            <button
              className="btn secondary"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Logout
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

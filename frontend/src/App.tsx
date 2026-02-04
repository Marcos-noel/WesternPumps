import { Navigate, Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar";
import LoginPage from "./pages/LoginPage";
import CustomersPage from "./pages/CustomersPage";
import JobsPage from "./pages/JobsPage";
import InventoryPage from "./pages/InventoryPage";
import SuppliersPage from "./pages/SuppliersPage";
import { useAuth } from "./state/AuthContext";

function Protected({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<Navigate to="/customers" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/customers"
          element={
            <Protected>
              <CustomersPage />
            </Protected>
          }
        />
        <Route
          path="/jobs"
          element={
            <Protected>
              <JobsPage />
            </Protected>
          }
        />
        <Route
          path="/inventory"
          element={
            <Protected>
              <InventoryPage />
            </Protected>
          }
        />
        <Route
          path="/suppliers"
          element={
            <Protected>
              <SuppliersPage />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

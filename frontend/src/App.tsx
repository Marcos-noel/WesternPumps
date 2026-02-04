import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "antd";
import NavBar from "./components/NavBar";
import LoginPage from "./pages/LoginPage";
import CustomersPage from "./pages/CustomersPage";
import JobsPage from "./pages/JobsPage";
import InventoryPage from "./pages/InventoryPage";
import SuppliersPage from "./pages/SuppliersPage";
import UsersPage from "./pages/UsersPage";
import CategoriesPage from "./pages/CategoriesPage";
import LocationsPage from "./pages/LocationsPage";
import RequestsPage from "./pages/RequestsPage";
import ReportsPage from "./pages/ReportsPage";
import { useAuth } from "./state/AuthContext";

const disableAuth = import.meta.env.VITE_DISABLE_AUTH !== "false";

function Protected({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AdminOnly({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isAdmin, loadingUser } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (loadingUser) {
    return (
      <div className="container">
        <p className="muted">Loading...</p>
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/customers" replace />;
  return children;
}

export default function App() {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <NavBar />
      <Layout.Content style={{ padding: "24px 24px 40px" }}>
        <Routes>
          <Route path="/" element={<Navigate to="/customers" replace />} />
          <Route path="/login" element={disableAuth ? <Navigate to="/customers" replace /> : <LoginPage />} />
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
            path="/categories"
            element={
              <Protected>
                <CategoriesPage />
              </Protected>
            }
          />
          <Route
            path="/locations"
            element={
              <Protected>
                <LocationsPage />
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
          <Route
            path="/requests"
            element={
              <Protected>
                <RequestsPage />
              </Protected>
            }
          />
          <Route
            path="/reports"
            element={
              <Protected>
                <ReportsPage />
              </Protected>
            }
          />
          <Route
            path="/users"
            element={
              <AdminOnly>
                <UsersPage />
              </AdminOnly>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout.Content>
    </Layout>
  );
}

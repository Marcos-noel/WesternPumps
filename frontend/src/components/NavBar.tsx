import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Layout, Menu, Typography } from "antd";
import { useAuth } from "../state/AuthContext";

export default function NavBar() {
  const { isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const disableAuth = import.meta.env.VITE_DISABLE_AUTH !== "false";
  const location = useLocation();

  const menuItems = useMemo(
    () =>
      [
        { key: "/customers", label: "Customers" },
        { key: "/jobs", label: "Jobs" },
        { key: "/inventory", label: "Inventory" },
        { key: "/categories", label: "Categories" },
        { key: "/locations", label: "Locations" },
        { key: "/suppliers", label: "Suppliers" },
        { key: "/requests", label: "Requests" },
        { key: "/reports", label: "Reports" },
        isAdmin ? { key: "/users", label: "Users" } : null
      ].filter(Boolean) as Array<{ key: string; label: string }>,
    [isAdmin]
  );

  const selectedKey = menuItems.find((item) => location.pathname.startsWith(item.key))?.key;

  return (
    <Layout.Header style={{ paddingInline: 20, display: "flex", alignItems: "center", gap: 16 }}>
      <Typography.Title level={4} style={{ color: "#fff", margin: 0, minWidth: 150 }}>
        WesternPumps
      </Typography.Title>
      {isAuthenticated ? (
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={selectedKey ? [selectedKey] : []}
          items={menuItems}
          onClick={(e) => navigate(e.key)}
          style={{ flex: 1 }}
        />
      ) : (
        <div style={{ flex: 1 }} />
      )}
      {isAuthenticated && !disableAuth ? (
        <Button
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          Logout
        </Button>
      ) : null}
    </Layout.Header>
  );
}

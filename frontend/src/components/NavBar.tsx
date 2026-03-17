import { useMemo } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge, Menu } from "antd";
import {
  BellOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import {
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  Description as DescriptionIcon,
  Settings as SettingsIcon,
  Inventory as InventoryIcon,
  Business as BusinessIcon,
  Build as BuildIcon,
  LocalShipping as LocalShippingIcon,
  Category as CategoryIcon,
  LocationOn as LocationOnIcon,
  Assessment as AssessmentIcon,
  People as PeopleIcon,
  SupportAgent as SupportAgentIcon,
  School as SchoolIcon,
  AccountCircle as AccountCircleIcon,
  Notifications as NotificationsIcon,
  Timeline as TimelineIcon,
  Science as ScienceIcon,
  CloudQueue as CloudQueueIcon,
  AccountTree as AccountTreeIcon,
} from "@mui/icons-material";
import { useAuth } from "../state/AuthContext";
import { useNotifications } from "../state/NotificationsContext";
import { canAccessPage } from "../utils/access";

export default function NavBar() {
  const { isAdmin, user } = useAuth();
  const role = user?.role ?? "technician";
  const navigate = useNavigate();
  const location = useLocation();
  const { pendingCount, unreadCount } = useNotifications();

  const notificationBadgeIcon = () => (
    <Badge
      count={unreadCount}
      size="small"
      offset={[2, 0]}
      style={{ boxShadow: "none" }}
    >
      <BellOutlined style={{ fontSize: 18 }} />
    </Badge>
  );
  const requestBadgeIcon = () => (
    <Badge
      count={pendingCount >= 2 ? pendingCount : 0}
      dot={pendingCount === 1}
      size="small"
      offset={[2, 0]}
    >
      <InboxOutlined />
    </Badge>
  );
  const navIcon = (icon: ReactNode) => <span className="nav-icon">{icon}</span>;

  const menuItems = useMemo(
    () =>
      [
        { key: "/dashboard", label: <span className="app-menu-label">Dashboard</span>, title: "Dashboard", icon: navIcon(<DashboardIcon />) },
        {
          key: "__notifications__",
          label: (
            <span className="app-menu-label">
              Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
            </span>
          ),
          title: "Notifications",
          icon: navIcon(notificationBadgeIcon()),
        },
        canAccessPage(role, "assistant")
          ? { key: "/assistant", label: <span className="app-menu-label">AI Assistant</span>, title: "AI Assistant", icon: navIcon(<SupportAgentIcon />) }
          : null,
        canAccessPage(role, "console")
          ? { key: "/console", label: <span className="app-menu-label">Console</span>, title: "Console", icon: navIcon(<AnalyticsIcon />) }
          : null,
        canAccessPage(role, "customers")
          ? { key: "/customers", label: <span className="app-menu-label">Customers</span>, title: "Customers", icon: navIcon(<PeopleIcon />) }
          : null,
        canAccessPage(role, "jobs")
          ? { key: "/jobs", label: <span className="app-menu-label">Jobs</span>, title: "Jobs", icon: navIcon(<BuildIcon />) }
          : null,
        canAccessPage(role, "deliveries")
          ? { key: "/deliveries", label: <span className="app-menu-label">Deliveries</span>, title: "Deliveries", icon: navIcon(<LocalShippingIcon />) }
          : null,
        canAccessPage(role, "inventory")
          ? { key: "/inventory", label: <span className="app-menu-label">Inventory</span>, title: "Inventory", icon: navIcon(<InventoryIcon />) }
          : null,
        canAccessPage(role, "operations")
          ? { key: "/operations", label: <span className="app-menu-label">Operations</span>, title: "Operations", icon: navIcon(<BusinessIcon />) }
          : null,
        canAccessPage(role, "categories")
          ? { key: "/categories", label: <span className="app-menu-label">Categories</span>, title: "Categories", icon: navIcon(<CategoryIcon />) }
          : null,
        canAccessPage(role, "locations")
          ? { key: "/locations", label: <span className="app-menu-label">Locations</span>, title: "Locations", icon: navIcon(<LocationOnIcon />) }
          : null,
        canAccessPage(role, "suppliers")
          ? { key: "/suppliers", label: <span className="app-menu-label">Suppliers</span>, title: "Suppliers", icon: navIcon(<AssessmentIcon />) }
          : null,
        canAccessPage(role, "requests")
          ? { key: "/requests", label: <span className="app-menu-label">Requests</span>, title: "Requests", icon: navIcon(requestBadgeIcon()) }
          : null,
        canAccessPage(role, "approvals")
          ? { key: "/approvals", label: <span className="app-menu-label">Approvals</span>, title: "Approvals", icon: navIcon(requestBadgeIcon()) }
          : null,
        canAccessPage(role, "reports")
          ? { key: "/reports", label: <span className="app-menu-label">Reports</span>, title: "Reports", icon: navIcon(<AnalyticsIcon />) }
          : null,
        canAccessPage(role, "reports_v2")
          ? { key: "/reports-v2", label: <span className="app-menu-label">Advanced Reports</span>, title: "Advanced Reports", icon: navIcon(<AnalyticsIcon />) }
          : null,
        canAccessPage(role, "audit")
          ? { key: "/audit", label: <span className="app-menu-label">Audit Log</span>, title: "Audit Log", icon: navIcon(<TimelineIcon />) }
          : null,
        canAccessPage(role, "inventory_science")
          ? { key: "/inventory-science", label: <span className="app-menu-label">Inventory Science</span>, title: "Inventory Science", icon: navIcon(<ScienceIcon />) }
          : null,
        canAccessPage(role, "platform")
          ? { key: "/platform", label: <span className="app-menu-label">Platform</span>, title: "Platform", icon: navIcon(<SettingsIcon />) }
          : null,
        canAccessPage(role, "workflow")
          ? { key: "/workflow", label: <span className="app-menu-label">Workflow</span>, title: "Workflow", icon: navIcon(<AccountTreeIcon />) }
          : null,
        canAccessPage(role, "admin_settings")
          ? { key: "/admin/settings", label: <span className="app-menu-label">Settings</span>, title: "Settings", icon: navIcon(<SettingsIcon />) }
          : null,
        isAdmin ? { key: "/users", label: <span className="app-menu-label">Users</span>, title: "Users", icon: navIcon(<PeopleIcon />) } : null,
        canAccessPage(role, "guide")
          ? { key: "/guide", label: <span className="app-menu-label">System Guide</span>, title: "System Guide", icon: navIcon(<SchoolIcon />) }
          : null,
        canAccessPage(role, "inventory_guide")
          ? { key: "/inventory-guide", label: <span className="app-menu-label">Inventory Guide</span>, title: "Inventory Guide", icon: navIcon(<SchoolIcon />) }
          : null,
        canAccessPage(role, "my_settings")
          ? { key: "/my-settings", label: <span className="app-menu-label">My Settings</span>, title: "My Settings", icon: navIcon(<AccountCircleIcon />) }
          : null
      ].filter(Boolean) as Array<{ key: string; label: ReactNode; title: string; icon: ReactNode }>,
    [isAdmin, pendingCount, unreadCount, role]
  );

  const selectedKey = menuItems.find((item) => item.key !== "__notifications__" && location.pathname.startsWith(item.key))?.key;

  return (
    <Menu
      mode="inline"
      selectedKeys={selectedKey ? [selectedKey] : []}
      items={menuItems}
      onClick={(e) => {
        if (e.key === "__notifications__") {
          // Scroll to top and open the header notification bell (if visible),
          // or navigate to dashboard where notifications are shown.
          window.scrollTo({ top: 0, behavior: "smooth" });
          const bellBtn = document.querySelector<HTMLButtonElement>(".app-header-tool--notifications button");
          if (bellBtn) {
            bellBtn.click();
          } else {
            navigate("/dashboard");
          }
          return;
        }
        navigate(e.key);
      }}
      className="app-menu"
      style={{ borderRight: 0 }}
    />
  );
}

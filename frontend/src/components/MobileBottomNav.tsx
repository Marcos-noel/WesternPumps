import { TabBar } from "antd-mobile";
import { Badge } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { Dashboard as DashboardIcon, Inventory as InventoryIcon, AccountCircle as AccountCircleIcon } from "@mui/icons-material";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNotifications } from "../state/NotificationsContext";

type Props = {
  canViewInventory: boolean;
};

export default function MobileBottomNav({ canViewInventory }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useNotifications();

  const tabs = useMemo(
    () => [
      { key: "/dashboard", title: "Dashboard", icon: <span className="nav-icon nav-icon-mobile"><DashboardIcon /></span> },
      ...(canViewInventory ? [{ key: "/inventory", title: "Inventory", icon: <span className="nav-icon nav-icon-mobile"><InventoryIcon /></span> }] : []),
      {
        key: "__notifications__",
        title: "Alerts",
        icon: (
          <Badge count={unreadCount} size="small" offset={[2, -2]}>
            <span className="nav-icon nav-icon-mobile"><BellOutlined style={{ fontSize: 20 }} /></span>
          </Badge>
        ),
      },
      { key: "/my-settings", title: "Profile", icon: <span className="nav-icon nav-icon-mobile"><AccountCircleIcon /></span> },
    ],
    [canViewInventory, unreadCount]
  );

  const activeKey =
    tabs.find((tab) => tab.key !== "__notifications__" && location.pathname.startsWith(tab.key))?.key ?? "/dashboard";

  return (
    <div className="mobile-bottom-nav">
      <TabBar
        activeKey={activeKey}
        onChange={(key: string) => {
          if (key === "__notifications__") {
            // Try to open the header notification bell popover
            const bellBtn = document.querySelector<HTMLButtonElement>(".app-header-tool--notifications button");
            if (bellBtn) {
              bellBtn.click();
            } else {
              navigate("/dashboard");
            }
            return;
          }
          navigate(key);
        }}
        safeArea
      >
        {tabs.map((item) => (
          <TabBar.Item key={item.key} icon={item.icon} title={item.title} />
        ))}
      </TabBar>
    </div>
  );
}

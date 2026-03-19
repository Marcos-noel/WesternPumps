import React from "react";
import { ActionIcon, Badge, Button, Card, Group, Text } from "@mantine/core";
import {
  TrendingUp as ArrowTrendingUpIcon,
  Inventory as ArchiveBoxIcon,
  Store as BuildingStoreIcon,
  LightMode as SunIcon,
  DarkMode as MoonIcon,
  LocalShipping as TruckIcon,
  Wifi as WifiIcon
} from "@mui/icons-material";
import { Link, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useRealtimeFeed } from "./RealtimeProvider";
import { useThemeMode } from "../state/ThemeContext";

const navItems = [
  { to: "/modern/dashboard", label: "Dashboard", icon: ArchiveBoxIcon },
  { to: "/modern/products", label: "Products", icon: BuildingStoreIcon },
  { to: "/modern/suppliers", label: "Suppliers", icon: TruckIcon },
  { to: "/modern/orders", label: "Orders & Receiving", icon: ArchiveBoxIcon },
  { to: "/modern/analytics", label: "Analytics & Forecasting", icon: ArrowTrendingUpIcon },
  { to: "/modern/live", label: "Live Stream", icon: WifiIcon }
];

export default function ModernShell() {
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useThemeMode();
  const { connected } = useRealtimeFeed();

  return (
    <div className="modern-root">
      <Card radius="xl" className="glass-panel mb-4">
        <Group justify="space-between" align="center">
          <Group>
            <Text fw={700} className="tracking-widest">MODERN INVENTORY CONSOLE</Text>
            <Badge color={connected ? "teal" : "gray"} variant="light">
              {connected ? "LIVE" : "OFFLINE"}
            </Badge>
          </Group>
          <Group>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to;
              return (
                <Button
                  key={item.to}
                  component={Link}
                  to={item.to}
                  variant={active ? "filled" : "light"}
                  leftSection={<Icon width={16} />}
                  className="transition-transform duration-150 hover:-translate-y-0.5"
                >
                  {item.label}
                </Button>
              );
            })}
            <ActionIcon aria-label="Toggle color mode" variant="light" size="lg" onClick={toggleTheme}>
              {isDarkMode ? <SunIcon width={18} /> : <MoonIcon width={18} />}
            </ActionIcon>
          </Group>
        </Group>
      </Card>

      <div>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
}

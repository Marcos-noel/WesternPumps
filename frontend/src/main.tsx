import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App as AntdApp, ConfigProvider, theme as antdTheme } from "antd";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "./state/AuthContext";
import { NotificationsProvider } from "./state/NotificationsContext";
import { ThemeProvider, useThemeMode } from "./state/ThemeContext";
import { modernQueryClient } from "./modern/queryClient";
import { RealtimeProvider } from "./modern/RealtimeProvider";
import "antd/dist/reset.css";
import "antd-mobile/es/global";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "./tailwind.css";
import "./styles.css";

function AppRoot() {
  const { isDarkMode } = useThemeMode();

  return (
    <MantineProvider defaultColorScheme={isDarkMode ? "dark" : "light"} forceColorScheme={isDarkMode ? "dark" : "light"}>
      <ModalsProvider>
        <Notifications position="top-right" />
        <QueryClientProvider client={modernQueryClient}>
          <RealtimeProvider>
            <ConfigProvider
              theme={{
                algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
                token: {
                  colorPrimary: "#4cc3ff",
                  colorInfo: "#4cc3ff",
                  colorSuccess: "#6ee7b7",
                  colorWarning: "#f1cc6b",
                  colorError: "#ff6b6b",
                  colorText: isDarkMode ? "#e6f3ff" : "#1f2d3d",
                  colorTextSecondary: isDarkMode ? "#9bb2cf" : "#4f6175",
                  colorBgLayout: isDarkMode ? "#05070f" : "#f1f6ff",
                  colorBgContainer: isDarkMode ? "#0c1422" : "#ffffff",
                  colorBorder: isDarkMode ? "rgba(90, 200, 255, 0.25)" : "rgba(76, 132, 188, 0.28)",
                  colorBorderSecondary: isDarkMode ? "rgba(90, 200, 255, 0.12)" : "rgba(76, 132, 188, 0.14)",
                  borderRadius: 14,
                  controlHeight: 40,
                  fontFamily: '"Space Grotesk", "IBM Plex Sans", "Segoe UI", sans-serif'
                }
              }}
            >
              <AntdApp>
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                  <AuthProvider>
                    <NotificationsProvider>
                      <App />
                    </NotificationsProvider>
                  </AuthProvider>
                </BrowserRouter>
              </AntdApp>
            </ConfigProvider>
          </RealtimeProvider>
        </QueryClientProvider>
      </ModalsProvider>
    </MantineProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppRoot />
    </ThemeProvider>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA registration is optional in development/runtime environments.
    });
  });
}

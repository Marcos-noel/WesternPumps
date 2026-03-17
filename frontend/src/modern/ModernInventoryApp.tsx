import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import ModernShell from "./ModernShell";
import DashboardPageV2 from "./pages/DashboardPageV2";
import ProductsPageV2 from "./pages/ProductsPageV2";
import SuppliersPageV2 from "./pages/SuppliersPageV2";
import OrdersReceivingPageV2 from "./pages/OrdersReceivingPageV2";
import AnalyticsPageV2 from "./pages/AnalyticsPageV2";
import LiveStreamPageV2 from "./pages/LiveStreamPageV2";

export default function ModernInventoryApp() {
  return (
    <AnimatePresence mode="wait">
      <Routes>
        <Route path="/" element={<ModernShell />}>
          <Route index element={<Navigate to="/modern/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPageV2 />} />
          <Route path="products" element={<ProductsPageV2 />} />
          <Route path="suppliers" element={<SuppliersPageV2 />} />
          <Route path="orders" element={<OrdersReceivingPageV2 />} />
          <Route path="analytics" element={<AnalyticsPageV2 />} />
          <Route path="live" element={<LiveStreamPageV2 />} />
          <Route path="*" element={<Navigate to="/modern/dashboard" replace />} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

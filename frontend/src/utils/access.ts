import type { UserRole } from "../api/types";

export type AppPageKey =
  | "assistant"
  | "console"
  | "dashboard"
  | "customers"
  | "jobs"
  | "deliveries"
  | "inventory"
  | "operations"
  | "categories"
  | "locations"
  | "suppliers"
  | "requests"
  | "approvals"
  | "reports"
  | "reports_v2"
  | "users"
  | "admin_settings"
  | "guide"
  | "inventory_guide"
  | "my_settings"
  | "audit"
  | "inventory_science"
  | "platform"
  | "workflow";

const ACCESS_RULES: Record<AppPageKey, UserRole[]> = {
  assistant: ["admin", "manager", "store_manager", "approver", "lead_technician", "technician", "finance", "staff"],
  console: ["admin", "manager", "store_manager", "approver", "lead_technician", "technician", "finance", "staff"],
  dashboard: ["admin", "manager", "store_manager", "approver", "lead_technician", "technician", "finance", "staff", "rider", "driver"],
  customers: ["admin", "manager", "store_manager", "lead_technician"],
  jobs: ["admin", "manager", "store_manager", "lead_technician", "technician", "staff"],
  deliveries: ["admin", "manager", "store_manager", "lead_technician", "technician", "staff", "rider", "driver"],
  inventory: ["admin", "manager", "store_manager"],
  operations: ["admin", "manager", "store_manager", "finance"],
  categories: ["admin", "manager", "store_manager"],
  locations: ["admin", "manager", "store_manager"],
  suppliers: ["admin", "manager", "store_manager"],
  requests: ["admin", "manager", "store_manager", "approver", "lead_technician", "technician", "staff"],
  approvals: ["admin", "manager", "approver"],
  reports: ["admin", "manager", "finance"],
  reports_v2: ["admin", "manager", "finance"],
  users: ["admin"],
  admin_settings: ["admin", "manager", "finance"],
  guide: ["admin", "manager", "store_manager", "approver", "lead_technician", "technician", "finance", "staff", "rider", "driver"],
  inventory_guide: ["admin", "manager", "store_manager"],
  my_settings: ["admin", "manager", "store_manager", "approver", "lead_technician", "technician", "finance", "staff", "rider", "driver"],
  audit: ["admin"],
  inventory_science: ["admin", "manager", "store_manager"],
  platform: ["admin"],
  workflow: ["admin", "manager"],
};

export function normalizeRole(role: string | null | undefined): UserRole {
  const raw = (role || "technician").toLowerCase();
  if (raw === "staff") return "staff";
  if (raw === "lead_technician") return "lead_technician";
  if (raw === "store_manager") return "store_manager";
  if (raw === "manager") return "manager";
  if (raw === "approver") return "approver";
  if (raw === "finance") return "finance";
  if (raw === "rider") return "rider";
  if (raw === "driver") return "driver";
  if (raw === "admin") return "admin";
  return "technician";
}

export function canAccessPage(role: string | null | undefined, page: AppPageKey): boolean {
  return (ACCESS_RULES[page] as UserRole[]).includes(normalizeRole(role));
}

export function allowedLandingPages(role: string | null | undefined): string[] {
  const map: Array<{ page: AppPageKey; path: string }> = [
    { page: "assistant", path: "/assistant" },
    { page: "console", path: "/console" },
    { page: "dashboard", path: "/dashboard" },
    { page: "jobs", path: "/jobs" },
    { page: "deliveries", path: "/deliveries" },
    { page: "requests", path: "/requests" },
    { page: "approvals", path: "/approvals" },
    { page: "inventory", path: "/inventory" },
    { page: "operations", path: "/operations" },
    { page: "customers", path: "/customers" },
    { page: "guide", path: "/guide" },
    { page: "inventory_guide", path: "/inventory-guide" },
    { page: "reports", path: "/reports" },
  ];
  return map.filter((entry) => canAccessPage(role, entry.page)).map((entry) => entry.path);
}

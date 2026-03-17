import { Card, Typography } from "antd";
import { useAuth } from "../state/AuthContext";

export default function SystemGuidePage() {
  const { user } = useAuth();
  const role = (user?.role || "technician").toLowerCase();
  const isAdmin = role === "admin";
  const isTech = ["technician", "lead_technician", "staff"].includes(role);
  const isApprover = ["approver", "manager", "admin"].includes(role);
  const isStore = ["store_manager", "manager", "admin"].includes(role);
  const isFinance = ["finance", "admin"].includes(role);

  const sections = [
    {
      key: "start",
      show: true,
      kicker: "Start Here",
      title: "Daily flow",
      lines: [
        "Check `Dashboard` for pending approvals, jobs, and alerts.",
        "Use `Requests` to ask for stock needed for jobs.",
        "Track your assigned work in `Jobs`.",
        "Review notifications from the top-right bell/activity icons."
      ]
    },
    {
      key: "tech",
      show: isAdmin || isTech,
      kicker: "Technicians",
      title: "What you handle",
      lines: [
        "Create stock requests for active jobs/customers.",
        "After issue, record usage with scan proof and optional GPS.",
        "Use request history to verify status: pending, approved, issued, closed."
      ]
    },
    {
      key: "approval",
      show: isAdmin || isApprover,
      kicker: "Approvers / Managers",
      title: "Governance",
      lines: [
        "Use `Approvals` to approve/reject pending requests.",
        "Add comments when approving/rejecting for audit traceability.",
        "Monitor reports, stock movement, and exposure on dashboard/reports."
      ]
    },
    {
      key: "store",
      show: isAdmin || isStore,
      kicker: "Store Team",
      title: "Inventory control",
      lines: [
        "Maintain items, suppliers, categories, and locations.",
        "Issue approved requests and process returns.",
        "Watch low-stock alerts and raise reorder requests."
      ]
    },
    {
      key: "finance",
      show: isAdmin || isFinance,
      kicker: "Finance Team",
      title: "Transparency",
      lines: [
        "Use `Reports` to export stock level, movement, and audit trail packs.",
        "Reconcile inventory value against movement deltas daily.",
        "Maintain finance integration endpoints for report delivery."
      ]
    },
    {
      key: "tracking",
      show: true,
      kicker: "Inventory Tracking",
      title: "Batch vs Serialized",
      lines: [
        "`BATCH` is for consumables where only total quantity matters.",
        "`SERIALIZED` (`INDIVIDUAL`) is for assets where each unit must be tracked separately.",
        "Use `BATCH` for fast issue/return counts.",
        "Use `SERIALIZED` when audits require exact unit history (who used which serial and when)."
      ]
    },
    {
      key: "security",
      show: true,
      kicker: "Security",
      title: "User accounts",
      lines: [
        "Account owners create users and assign roles by responsibility.",
        "Each user has role-based visibility and actions.",
        "Password reset links can be sent from user management/login."
      ]
    },
    {
      key: "help",
      show: true,
      kicker: "Need Help",
      title: "Troubleshooting",
      lines: [
        "If data looks stale, click `Refresh` on the current page.",
        "Use your workspace menu to navigate available modules.",
        "For backend/API errors, report the exact action and timestamp."
      ]
    }
  ].filter((s) => s.show);

  return (
    <div className="container page-shell">
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        System Guide
      </Typography.Title>
      <Card title="How To Use WesternPumps">
        <div className="inventory-guide-grid">
          {sections.map((section) => (
            <div className="guide-block" key={section.key}>
              <div className="guide-kicker">{section.kicker}</div>
              <Typography.Title level={5} className="guide-title">
                {section.title}
              </Typography.Title>
              <ul className="guide-list">
                {section.lines.map((line) => <li key={line}>{line}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

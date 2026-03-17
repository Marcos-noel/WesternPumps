import { Card, Typography } from "antd";

export default function InventoryGuidePage() {
  return (
    <div className="container page-shell">
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Inventory Guide
      </Typography.Title>
      <Card title="Inventory Operations Manual">
        <Typography.Paragraph className="muted" style={{ marginTop: 0 }}>
          This module manages items (parts), suppliers, stock movements, and issuing workflows.
        </Typography.Paragraph>
        <div className="inventory-guide-grid">
          <div className="guide-block">
            <div className="guide-kicker">Concept</div>
            <Typography.Title level={5} className="guide-title">
              Item
            </Typography.Title>
            <ul className="guide-list">
              <li>SKU (unique) and item name identify stock.</li>
              <li>Track quantity on hand and minimum operating stock.</li>
              <li>Attach image, supplier, category, and location.</li>
              <li>Use tracking type: `BATCH` or `INDIVIDUAL`.</li>
            </ul>
          </div>

          <div className="guide-block">
            <div className="guide-kicker">Concept</div>
            <Typography.Title level={5} className="guide-title">
              Stock transaction
            </Typography.Title>
            <ul className="guide-list">
              <li>`IN` increases stock.</li>
              <li>`OUT` decreases stock.</li>
              <li>`ADJUST` corrects quantity or state.</li>
              <li>Each transaction is audit-tracked with actor and timestamp.</li>
            </ul>
          </div>

          <div className="guide-block">
            <div className="guide-kicker">Issuing Flow</div>
            <Typography.Title level={5} className="guide-title">
              Request lifecycle
            </Typography.Title>
            <ul className="guide-list">
              <li>Technician creates request.</li>
              <li>Approver reviews and approves/rejects.</li>
              <li>Store team issues stock and records serial/batch lines.</li>
              <li>Technician records usage; store team records returns.</li>
            </ul>
          </div>

          <div className="guide-block">
            <div className="guide-kicker">Policy</div>
            <Typography.Title level={5} className="guide-title">
              Low stock
            </Typography.Title>
            <Typography.Text className="muted">An item is low stock when:</Typography.Text>
            <div className="guide-inline">
              <Typography.Text code>quantity_on_hand &lt;= min_quantity</Typography.Text>
            </div>
          </div>

          <div className="guide-block">
            <div className="guide-kicker">Tools</div>
            <Typography.Title level={5} className="guide-title">
              QR / Barcode
            </Typography.Title>
            <ul className="guide-list">
              <li>Item QR can encode SKU for quick lookup.</li>
              <li>Serialized items use per-instance serial/barcode values.</li>
              <li>Use labels in store/job sites for faster issuing and validation.</li>
            </ul>
          </div>

          <div className="guide-block">
            <div className="guide-kicker">Tracking Types</div>
            <Typography.Title level={5} className="guide-title">
              Batch vs Serialized
            </Typography.Title>
            <ul className="guide-list">
              <li>`BATCH`: quantity-based stock (e.g., bolts, seals, tape).</li>
              <li>`BATCH`: you issue/return by number of units, not unique serials.</li>
              <li>`SERIALIZED` (`INDIVIDUAL`): each unit has its own serial number/QR.</li>
              <li>`SERIALIZED`: use for tools/equipment that need unit-level history and traceability.</li>
            </ul>
          </div>

          <div className="guide-block">
            <div className="guide-kicker">Reports</div>
            <Typography.Title level={5} className="guide-title">
              Exports
            </Typography.Title>
            <ul className="guide-list">
              <li>Stock levels (Excel/PDF).</li>
              <li>Stock movement export.</li>
              <li>Low-stock view and reorder follow-up.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

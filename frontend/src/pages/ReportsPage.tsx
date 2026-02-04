import React, { useState } from "react";
import { Button, Card, Space, Typography } from "antd";
import { api } from "../api/client";
import { getApiErrorMessage } from "../api/error";

async function downloadReport(path: string, filename: string) {
  const resp = await api.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(resp.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [error, setError] = useState<string | null>(null);

  async function handle(path: string, filename: string) {
    setError(null);
    try {
      await downloadReport(path, filename);
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to download report"));
    }
  }

  return (
    <div className="container">
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Reports
      </Typography.Title>
      <Card title="Stock Levels">
        <Space>
          <Button onClick={() => handle("/api/reports/stock-level?format=excel", "stock-levels.xlsx")}>Excel</Button>
          <Button onClick={() => handle("/api/reports/stock-level?format=pdf", "stock-levels.pdf")}>PDF</Button>
          <Button onClick={() => handle("/api/reports/stock-level?format=docx", "stock-levels.docx")}>DOCX</Button>
        </Space>
      </Card>

      <Card title="Stock Movements" style={{ marginTop: 12 }}>
        <Space>
          <Button onClick={() => handle("/api/reports/stock-movement?format=excel", "stock-movements.xlsx")}>Excel</Button>
          <Button onClick={() => handle("/api/reports/stock-movement?format=pdf", "stock-movements.pdf")}>PDF</Button>
          <Button onClick={() => handle("/api/reports/stock-movement?format=docx", "stock-movements.docx")}>DOCX</Button>
        </Space>
      </Card>

      {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
    </div>
  );
}

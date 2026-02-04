import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, InputNumber, Select, Space, Table, Tag, Typography } from "antd";
import { listItems } from "../api/items";
import { approveRequest, createRequest, issueRequest, listRequests, rejectRequest } from "../api/requests";
import type { Item, StockRequest } from "../api/types";
import { getApiErrorMessage } from "../api/error";
import { useAuth } from "../state/AuthContext";

type LineDraft = { part_id: number | ""; quantity: number };

export default function RequestsPage() {
  const { user } = useAuth();
  const role = user?.role ?? "technician";

  const [items, setItems] = useState<Item[]>([]);
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lines, setLines] = useState<LineDraft[]>([{ part_id: "", quantity: 1 }]);

  const isApprover = useMemo(() => ["admin", "manager", "approver"].includes(role), [role]);
  const isStoreManager = role === "store_manager" || role === "admin";

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const itemsResp = await listItems({ page: 1, page_size: 200, sort: "name", direction: "asc" });
      setItems(itemsResp.items);
      const reqs = await listRequests(isApprover || isStoreManager ? undefined : { mine: true });
      setRequests(reqs);
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to load requests"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit() {
    setError(null);
    const payloadLines = lines
      .filter((l) => l.part_id !== "" && l.quantity > 0)
      .map((l) => ({ part_id: Number(l.part_id), quantity: l.quantity }));
    if (payloadLines.length === 0) {
      setError("Add at least one item");
      return;
    }
    try {
      await createRequest({ lines: payloadLines });
      setLines([{ part_id: "", quantity: 1 }]);
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to submit request"));
    }
  }

  function updateLine(index: number, changes: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...changes } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { part_id: "", quantity: 1 }]);
  }

  async function handleApprove(req: StockRequest) {
    try {
      await approveRequest(req.id);
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to approve request"));
    }
  }

  async function handleReject(req: StockRequest) {
    const reason = prompt("Rejection reason?");
    if (!reason) return;
    try {
      await rejectRequest(req.id, reason);
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to reject request"));
    }
  }

  async function handleIssue(req: StockRequest) {
    try {
      const linesPayload = req.lines.map((l) => ({
        line_id: l.id,
        quantity: l.quantity,
        item_instance_ids: []
      }));
      await issueRequest(req.id, { lines: linesPayload });
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to issue request"));
    }
  }

  const itemNameById = useMemo(() => new Map(items.map((i) => [i.id, i.name])), [items]);

  const statusColor = (status: string) => {
    if (status === "APPROVED") return "green";
    if (status === "REJECTED") return "red";
    if (status === "ISSUED") return "blue";
    return "gold";
  };

  const columns = useMemo(
    () => [
      { title: "ID", dataIndex: "id", key: "id" },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (value: string) => <Tag color={statusColor(value)}>{value}</Tag>
      },
      {
        title: "Items",
        dataIndex: "lines",
        key: "lines",
        render: (_: unknown, request: StockRequest) =>
          request.lines.map((l) => `${itemNameById.get(l.part_id) ?? l.part_id} x${l.quantity}`).join(", ")
      },
      {
        title: "Total",
        dataIndex: "total_value",
        key: "total_value",
        render: (value: number | null) => (value ? `$${value.toFixed(2)}` : "")
      },
      {
        title: "Actions",
        key: "actions",
        render: (_: unknown, request: StockRequest) => (
          <Space>
            {isApprover && request.status === "PENDING" ? (
              <>
                <Button onClick={() => handleApprove(request)}>Approve</Button>
                <Button onClick={() => handleReject(request)}>Reject</Button>
              </>
            ) : null}
            {isStoreManager && request.status === "APPROVED" ? (
              <Button onClick={() => handleIssue(request)}>Issue</Button>
            ) : null}
          </Space>
        )
      }
    ],
    [isApprover, isStoreManager, itemNameById]
  );

  return (
    <div className="container">
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Stock Requests
      </Typography.Title>
      <div className="grid">
        <Card title="Create request">
          <Form layout="vertical" onFinish={handleSubmit}>
            {lines.map((line, idx) => (
              <Space key={idx} align="start" wrap style={{ width: "100%", marginBottom: 8 }}>
                <Form.Item label={idx === 0 ? "Item" : ""} style={{ minWidth: 240, flex: 1 }}>
                  <Select<number>
                    value={line.part_id === "" ? undefined : line.part_id}
                    onChange={(value) => updateLine(idx, { part_id: value })}
                    placeholder="Select..."
                  >
                    {items.map((i) => (
                      <Select.Option key={i.id} value={i.id}>
                        {i.sku} — {i.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item label={idx === 0 ? "Qty" : ""}>
                  <InputNumber
                    min={1}
                    value={line.quantity}
                    onChange={(value) => updateLine(idx, { quantity: Number(value) || 1 })}
                  />
                </Form.Item>
              </Space>
            ))}
            <Space>
              <Button onClick={addLine}>Add line</Button>
              <Button type="primary" htmlType="submit">
                Submit request
              </Button>
            </Space>
          </Form>
          {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
        </Card>

        <Card
          title="Requests"
          extra={
            <Button onClick={refresh} disabled={loading}>
              Refresh
            </Button>
          }
        >
          <Table
            rowKey="id"
            loading={loading}
            dataSource={requests}
            columns={columns}
            pagination={false}
            locale={{ emptyText: "No requests yet." }}
          />
        </Card>
      </div>
    </div>
  );
}

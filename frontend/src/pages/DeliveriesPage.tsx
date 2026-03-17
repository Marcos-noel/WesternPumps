import { useEffect, useMemo, useState } from "react";
import { App as AntdApp, Button, Card, Input, Select, Space, Table, Tag, Typography } from "antd";
import {
  createDeliveryRequest,
  listDeliveryRequests,
  claimDeliveryRequest,
  pickupDeliveryRequest,
  deliverDeliveryRequest,
  cancelDeliveryRequest,
  assignDeliveryRequest,
  approveDeliveryRequest,
  rejectDeliveryRequest,
} from "../api/deliveries";
import { listRequests } from "../api/requests";
import { listUsers } from "../api/users";
import type { DeliveryRequest, StockRequest, User } from "../api/types";
import { useAuth } from "../state/AuthContext";
import { getApiErrorMessage } from "../api/error";
import { formatDateTime } from "../utils/datetime";
import { formatRequestRef } from "../utils/requestRef";

export default function DeliveriesPage() {
  const { message } = AntdApp.useApp();
  const { user } = useAuth();
  const role = (user?.role || "technician").toLowerCase();
  const isCourier = role === "rider" || role === "driver";
  const isStore = role === "admin" || role === "manager" || role === "store_manager";
  const canCreate = isStore || role === "technician" || role === "lead_technician" || role === "staff";

  const [rows, setRows] = useState<DeliveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [requestRows, setRequestRows] = useState<StockRequest[]>([]);
  const [couriers, setCouriers] = useState<User[]>([]);
  const [stockRequestId, setStockRequestId] = useState<number | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<"RIDER" | "DRIVER">("RIDER");
  const [pickupLocation, setPickupLocation] = useState("Store");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [equipmentSummary, setEquipmentSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [deliveryRows, reqs, users] = await Promise.all([
        listDeliveryRequests(),
        canCreate ? listRequests({ mine: !isStore }) : Promise.resolve([]),
        isStore ? listUsers() : Promise.resolve([]),
      ]);
      setRows(deliveryRows);
      setRequestRows(reqs);
      setCouriers((users || []).filter((u) => ["rider", "driver"].includes((u.role || "").toLowerCase())));
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to load delivery requests"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [role]);

  async function handleCreate() {
    if (equipmentSummary.trim().length < 3) {
      setError("Please enter what equipment/items are needed before submitting.");
      return;
    }
    setCreateLoading(true);
    setError(null);
    try {
      await createDeliveryRequest({
        stock_request_id: stockRequestId ?? null,
        delivery_mode: deliveryMode,
        pickup_location: pickupLocation.trim() || "Store",
        dropoff_location: dropoffLocation.trim() || null,
        equipment_summary: equipmentSummary.trim(),
        notes: notes.trim() || null,
      });
      message.success("Delivery request submitted");
      setStockRequestId(null);
      setDropoffLocation("");
      setEquipmentSummary("");
      setNotes("");
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to create delivery request"));
    } finally {
      setCreateLoading(false);
    }
  }

  async function runRowAction(action: () => Promise<unknown>, successMessage: string) {
    try {
      await action();
      message.success(successMessage);
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Delivery action failed"));
    }
  }

  const statusColor = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "PENDING") return "gold";
    if (s === "APPROVED") return "cyan";
    if (s === "ACCEPTED") return "blue";
    if (s === "PICKED_UP") return "purple";
    if (s === "DELIVERED") return "green";
    if (s === "CANCELED") return "red";
    return "default";
  };

  const displayStatus = (row: DeliveryRequest): string => {
    const raw = (row.status || "").toUpperCase();
    if (raw === "PENDING" && row.approved_at) return "APPROVED";
    return raw;
  };

  const columns = useMemo(
    () => [
      { title: "ID", dataIndex: "id", key: "id", width: 80 },
      {
        title: "Request",
        dataIndex: "stock_request_id",
        key: "stock_request_id",
        render: (value: number | null | undefined) => formatRequestRef(value ?? null),
      },
      { title: "Mode", dataIndex: "delivery_mode", key: "delivery_mode" },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (_value: string, row: DeliveryRequest) => {
          const current = displayStatus(row);
          return <Tag color={statusColor(current)}>{current}</Tag>;
        },
      },
      { title: "Pickup", dataIndex: "pickup_location", key: "pickup_location" },
      { title: "Dropoff", dataIndex: "dropoff_location", key: "dropoff_location" },
      {
        title: "Created",
        dataIndex: "created_at",
        key: "created_at",
        render: (value: string) => formatDateTime(value),
      },
      {
        title: "Actions",
        key: "actions",
        render: (_: unknown, row: DeliveryRequest) => (
          <Space wrap>
            {isCourier && row.status === "PENDING" && Boolean(row.approved_at) ? (
              <Button size="small" onClick={() => void runRowAction(() => claimDeliveryRequest(row.id), "Delivery claimed")}>
                Claim
              </Button>
            ) : null}
            {isStore && row.status === "PENDING" && !row.approved_at ? (
              <Button size="small" type="primary" onClick={() => void runRowAction(() => approveDeliveryRequest(row.id), "Delivery approved")}>
                Approve
              </Button>
            ) : null}
            {isStore && row.status === "PENDING" && !row.approved_at ? (
              <Button
                size="small"
                danger
                onClick={() => {
                  const reason = window.prompt("Enter rejection reason:", "Insufficient details");
                  if (!reason || reason.trim().length < 2) return;
                  void runRowAction(() => rejectDeliveryRequest(row.id, reason.trim()), "Delivery rejected");
                }}
              >
                Reject
              </Button>
            ) : null}
            {((isCourier && row.assigned_to_user_id === user?.id) || isStore) && row.status === "ACCEPTED" ? (
              <Button size="small" onClick={() => void runRowAction(() => pickupDeliveryRequest(row.id), "Marked as picked up")}>
                Picked up
              </Button>
            ) : null}
            {((isCourier && row.assigned_to_user_id === user?.id) || isStore) && ["ACCEPTED", "PICKED_UP"].includes((row.status || "").toUpperCase()) ? (
              <Button size="small" type="primary" onClick={() => void runRowAction(() => deliverDeliveryRequest(row.id), "Delivery completed")}>
                Delivered
              </Button>
            ) : null}
            {(isStore || row.requested_by_user_id === user?.id) && !["DELIVERED", "CANCELED"].includes((row.status || "").toUpperCase()) ? (
              <Button
                size="small"
                danger
                onClick={() => void runRowAction(() => cancelDeliveryRequest(row.id, "Canceled from dashboard"), "Delivery canceled")}
              >
                Cancel
              </Button>
            ) : null}
            {isStore && row.status === "PENDING" && Boolean(row.approved_at) ? (
              <Select<number>
                size="small"
                style={{ minWidth: 180 }}
                placeholder="Assign courier"
                options={couriers.map((c) => ({ value: c.id, label: `${c.full_name || c.email} (${c.role})` }))}
                onChange={(value) => void runRowAction(() => assignDeliveryRequest(row.id, value), "Courier assigned")}
              />
            ) : null}
          </Space>
        ),
      },
    ],
    [couriers, isCourier, isStore, user?.id]
  );

  return (
    <div className="container page-shell">
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Deliveries
      </Typography.Title>
      {canCreate ? (
        <Card title="Request Rider/Driver" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            <Select<number>
              allowClear
              placeholder="Related stock request (optional)"
              value={stockRequestId ?? undefined}
              onChange={(value) => setStockRequestId(value ?? null)}
              options={requestRows.map((r) => ({ value: r.id, label: `${formatRequestRef(r.id)} (${r.status})` }))}
            />
            <Space wrap>
              <Select<"RIDER" | "DRIVER"> value={deliveryMode} onChange={setDeliveryMode} options={[{ value: "RIDER", label: "Rider" }, { value: "DRIVER", label: "Driver" }]} />
              <Input
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                placeholder="Pickup location"
                style={{ minWidth: 220 }}
              />
              <Input
                value={dropoffLocation}
                onChange={(e) => setDropoffLocation(e.target.value)}
                placeholder="Dropoff / technician location"
                style={{ minWidth: 220 }}
              />
            </Space>
            <Input.TextArea value={equipmentSummary} onChange={(e) => setEquipmentSummary(e.target.value)} rows={2} placeholder="Equipment summary (what to bring)" />
            <Input.TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes (optional)" />
            <Button type="primary" loading={createLoading} onClick={() => void handleCreate()}>
              Submit Delivery Request
            </Button>
          </Space>
        </Card>
      ) : null}

      <Card
        title={isCourier ? "Approved/Assigned Delivery Requests" : "Delivery Requests"}
        extra={
          <Button onClick={() => void refresh()} disabled={loading}>
            Refresh
          </Button>
        }
      >
        {error ? (
          <Typography.Text type="danger" style={{ display: "block", marginBottom: 12 }}>
            {error}
          </Typography.Text>
        ) : null}
        <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={{ pageSize: 12 }} />
      </Card>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { App as AntdApp, Button, Card, Drawer, Dropdown, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography } from "antd";
import type { MenuProps } from "antd";
import { MoreOutlined } from "@ant-design/icons";
import { listCustomers } from "../api/customers";
import { createJob, listJobs, updateJob } from "../api/jobs";
import { listAssignableUsers, listUsers } from "../api/users";
import type { Customer, Job, User } from "../api/types";
import { getApiErrorMessage } from "../api/error";
import { useAuth } from "../state/AuthContext";
import { formatDateTime } from "../utils/datetime";
import { useNavigate } from "react-router-dom";

const statusOptions = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" }
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" }
];

export default function JobsPage() {
  const { message } = AntdApp.useApp();
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role ?? "technician";
  const canManageJobs = isAdmin || role === "manager" || role === "store_manager" || role === "lead_technician";
  const isTechnicianView = !canManageJobs;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState<number | "">("");
  const [siteLocationLabel, setSiteLocationLabel] = useState("");
  const [siteLatitude, setSiteLatitude] = useState<number | null>(null);
  const [siteLongitude, setSiteLongitude] = useState<number | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | "">("");
  const [filterPriority, setFilterPriority] = useState<string | "">("");
  const [filterCustomer, setFilterCustomer] = useState<number | "">("");

  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [editing, setEditing] = useState<Job | null>(null);

  const [editCustomerId, setEditCustomerId] = useState<number | "">("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState("open");
  const [editPriority, setEditPriority] = useState("medium");
  const [editAssignedTo, setEditAssignedTo] = useState<number | "">("");
  const [editSiteLocationLabel, setEditSiteLocationLabel] = useState("");
  const [editSiteLatitude, setEditSiteLatitude] = useState<number | null>(null);
  const [editSiteLongitude, setEditSiteLongitude] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [c, j] = await Promise.all([listCustomers(), listJobs()]);
      setCustomers(c);
      setJobs(j);
      if (isAdmin) {
        const u = await listUsers();
        setUsers(u);
      } else if (canManageJobs) {
        const u = await listAssignableUsers();
        setUsers(u);
      } else {
        setUsers([]);
      }
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to load jobs"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [isAdmin, canManageJobs]);

  async function handleCreate() {
    setError(null);
    if (customerId === "") {
      setError("Select a customer");
      return;
    }
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (siteLatitude == null || siteLongitude == null) {
      setError("Job site latitude and longitude are required");
      return;
    }
    setSaving(true);
    try {
      await createJob({
        customer_id: customerId,
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        status,
        priority,
        assigned_to_user_id: assignedTo === "" ? null : Number(assignedTo),
        site_location_label: siteLocationLabel.trim() || null,
        site_latitude: siteLatitude,
        site_longitude: siteLongitude,
      });
      setCustomerId("");
      setTitle("");
      setDescription("");
      setStatus("open");
      setPriority("medium");
      setAssignedTo("");
      setSiteLocationLabel("");
      setSiteLatitude(null);
      setSiteLongitude(null);
      message.success("Job created");
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to create job"));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(job: Job) {
    setEditing(job);
    setEditCustomerId(job.customer_id);
    setEditTitle(job.title);
    setEditDescription(job.description ?? "");
    setEditStatus(job.status || "open");
    setEditPriority(job.priority || "medium");
    setEditAssignedTo(job.assigned_to_user_id ?? "");
    setEditSiteLocationLabel(job.site_location_label ?? "");
    setEditSiteLatitude(job.site_latitude ?? null);
    setEditSiteLongitude(job.site_longitude ?? null);
  }

  async function handleUpdate() {
    if (!editing) return;
    setError(null);
    if (editCustomerId === "") {
      setError("Select a customer");
      return;
    }
    if (!editTitle.trim()) {
      setError("Title is required");
      return;
    }
    if (editSiteLatitude == null || editSiteLongitude == null) {
      setError("Job site latitude and longitude are required");
      return;
    }
    setSaving(true);
    try {
      await updateJob(editing.id, {
        customer_id: Number(editCustomerId),
        title: editTitle.trim(),
        description: editDescription.trim() ? editDescription.trim() : null,
        status: editStatus,
        priority: editPriority,
        assigned_to_user_id: editAssignedTo === "" ? null : Number(editAssignedTo),
        site_location_label: editSiteLocationLabel.trim() || null,
        site_latitude: editSiteLatitude,
        site_longitude: editSiteLongitude,
      });
      message.success("Job updated");
      setEditing(null);
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to update job"));
    } finally {
      setSaving(false);
    }
  }

  const customerNameById = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);
  const userNameById = useMemo(
    () => new Map(users.map((u) => [u.id, u.full_name || u.email])),
    [users]
  );

  const filteredJobs = useMemo(() => {
    let data = jobs;
    if (filterCustomer !== "") data = data.filter((job) => job.customer_id === filterCustomer);
    if (filterStatus) data = data.filter((job) => job.status === filterStatus);
    if (filterPriority) data = data.filter((job) => job.priority === filterPriority);
    const q = searchInput.trim().toLowerCase();
    if (q) {
      data = data.filter((job) => {
        const customer = customerNameById.get(job.customer_id) ?? "";
        return (
          String(job.id).includes(q) ||
          job.title.toLowerCase().includes(q) ||
          customer.toLowerCase().includes(q)
        );
      });
    }
    return data;
  }, [jobs, filterCustomer, filterPriority, filterStatus, searchInput, customerNameById]);

  const statusColor = (value: string) => {
    if (value === "completed") return "green";
    if (value === "in_progress") return "gold";
    if (value === "canceled") return "red";
    return "blue";
  };

  const priorityColor = (value: string) => {
    if (value === "high") return "red";
    if (value === "low") return "green";
    return "gold";
  };

  const statusLabel = (value: string) => value.replace(/_/g, " ").toUpperCase();

  const columns = useMemo(
    () => [
      { title: "ID", dataIndex: "id", key: "id", sorter: (a: Job, b: Job) => a.id - b.id },
      {
        title: "Customer",
        dataIndex: "customer_id",
        key: "customer_id",
        render: (value: number) => customerNameById.get(value) ?? value,
        sorter: (a: Job, b: Job) =>
          (customerNameById.get(a.customer_id) ?? "").localeCompare(customerNameById.get(b.customer_id) ?? "")
      },
      { title: "Title", dataIndex: "title", key: "title", sorter: (a: Job, b: Job) => a.title.localeCompare(b.title) },
      {
        title: "Site",
        key: "site",
        responsive: ["lg" as const],
        render: (_: unknown, job: Job) =>
          job.site_location_label || (job.site_latitude != null && job.site_longitude != null
            ? `${Number(job.site_latitude).toFixed(5)}, ${Number(job.site_longitude).toFixed(5)}`
            : "-"),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (value: string) => <Tag color={statusColor(value)}>{statusLabel(value)}</Tag>
      },
      {
        title: "Priority",
        dataIndex: "priority",
        key: "priority",
        render: (value: string) => <Tag color={priorityColor(value)}>{statusLabel(value)}</Tag>,
        sorter: (a: Job, b: Job) => a.priority.localeCompare(b.priority)
      },
      {
        title: "Assigned",
        key: "assigned",
        responsive: ["lg" as const],
        render: (_: unknown, job: Job) =>
          job.assigned_to_user_id ? userNameById.get(job.assigned_to_user_id) ?? "Assigned user unavailable" : "Unassigned"
      },
      {
        title: "Created",
        dataIndex: "created_at",
        key: "created_at",
        render: (value: string) => formatDateTime(value)
      },
      {
        title: "Updated",
        dataIndex: "updated_at",
        key: "updated_at",
        render: (value: string) => formatDateTime(value)
      },
      {
        title: "Actions",
        key: "actions",
        width: 140,
        render: (_: unknown, job: Job) => {
          const menuItems: MenuProps["items"] = [
            { key: "view", label: "View", onClick: () => setDetailJob(job) },
            canManageJobs ? { key: "edit", label: "Edit", onClick: () => startEdit(job) } : null
          ];
          return (
            <Dropdown menu={{ items: menuItems.filter(Boolean) as MenuProps["items"] }} trigger={["click"]}>
              <Button icon={<MoreOutlined />}>Manage</Button>
            </Dropdown>
          );
        }
      }
    ],
    [canManageJobs, customerNameById, userNameById]
  );

  const technicianColumns = useMemo(
    () => [
      { title: "ID", dataIndex: "id", key: "id", width: 70 },
      {
        title: "Job",
        dataIndex: "title",
        key: "title",
        ellipsis: true,
        render: (value: string, job: Job) => (
          <div>
            <div style={{ fontWeight: 600 }}>{value}</div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {customerNameById.get(job.customer_id) ?? `Customer #${job.customer_id}`}
            </Typography.Text>
          </div>
        )
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 120,
        render: (value: string) => <Tag color={statusColor(value)}>{statusLabel(value)}</Tag>
      },
      {
        title: "Updated",
        dataIndex: "updated_at",
        key: "updated_at",
        width: 170,
        render: (value: string) => formatDateTime(value)
      },
      {
        title: "Actions",
        key: "actions",
        width: 110,
        render: (_: unknown, job: Job) => (
          <Button size="small" onClick={() => setDetailJob(job)}>
            View
          </Button>
        )
      }
    ],
    [customerNameById]
  );

  return (
    <div className="container page-shell">
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Jobs
      </Typography.Title>
      {!canManageJobs ? (
        <Card>
          <Typography.Text type="secondary">
            Job creation and assignment is available to lead technicians, store managers, managers, and admins.
          </Typography.Text>
        </Card>
      ) : null}
      {canManageJobs ? (
        <Space>
          <Button onClick={() => setShowCreateForm((prev) => !prev)}>
            {showCreateForm ? "Hide Add Job" : "Add New Job"}
          </Button>
        </Space>
      ) : null}
      <div className="grid">
        {canManageJobs && showCreateForm ? (
        <Card title="Create job">
          <Form layout="vertical" onFinish={handleCreate}>
            <Form.Item label="Customer" required>
              <Select<number>
                value={customerId === "" ? undefined : customerId}
                onChange={(value) => setCustomerId(value)}
                placeholder="Select..."
              >
                {customers.map((c) => (
                  <Select.Option key={c.id} value={c.id}>
                    {c.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="Title" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Form.Item>
            <Form.Item label="Description">
              <Input.TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            </Form.Item>
            <Form.Item label="Site label (optional)">
              <Input value={siteLocationLabel} onChange={(e) => setSiteLocationLabel(e.target.value)} placeholder="e.g. Pump station A" />
            </Form.Item>
            <Space style={{ width: "100%" }} wrap>
              <Form.Item label="Site latitude" required style={{ minWidth: 220, flex: 1 }}>
                <InputNumber
                  style={{ width: "100%" }}
                  value={siteLatitude}
                  onChange={(value) => setSiteLatitude(value == null ? null : Number(value))}
                  placeholder="e.g. -1.292066"
                  step={0.000001}
                />
              </Form.Item>
              <Form.Item label="Site longitude" required style={{ minWidth: 220, flex: 1 }}>
                <InputNumber
                  style={{ width: "100%" }}
                  value={siteLongitude}
                  onChange={(value) => setSiteLongitude(value == null ? null : Number(value))}
                  placeholder="e.g. 36.821946"
                  step={0.000001}
                />
              </Form.Item>
            </Space>
            <Form.Item label="Status">
              <Select value={status} onChange={(value) => setStatus(value)} options={statusOptions} />
            </Form.Item>
            <Form.Item label="Priority">
              <Select value={priority} onChange={(value) => setPriority(value)} options={priorityOptions} />
            </Form.Item>
            {canManageJobs ? (
              <Form.Item label="Assign to">
                <Select<number>
                  allowClear
                  value={assignedTo === "" ? undefined : assignedTo}
                  onChange={(value) => setAssignedTo(value ?? "")}
                  placeholder="Unassigned"
                >
                  {users.map((u) => (
                    <Select.Option key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            ) : null}
            <Button type="primary" htmlType="submit" disabled={saving}>
              Create
            </Button>
          </Form>
          {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
        </Card>
        ) : null}

        <Card
          title="Job list"
          extra={
            <Button onClick={refresh} disabled={loading}>
              Refresh
            </Button>
          }
          style={{ gridColumn: "1 / -1" }}
        >
          <Space wrap style={{ marginBottom: 12, width: "100%" }} className="jobs-filter-wrap">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by job, customer, or ID"
              style={{ maxWidth: 320 }}
            />
            <Select
              value={filterCustomer === "" ? undefined : filterCustomer}
              onChange={(value) => setFilterCustomer(value ?? "")}
              placeholder="Filter customer"
              allowClear
              style={{ minWidth: 180 }}
            >
              {customers.map((c) => (
                <Select.Option key={c.id} value={c.id}>
                  {c.name}
                </Select.Option>
              ))}
            </Select>
            <Select
              value={filterStatus || undefined}
              onChange={(value) => setFilterStatus(value ?? "")}
              placeholder="Filter status"
              allowClear
              style={{ minWidth: 160 }}
              options={statusOptions}
            />
            <Select
              value={filterPriority || undefined}
              onChange={(value) => setFilterPriority(value ?? "")}
              placeholder="Filter priority"
              allowClear
              style={{ minWidth: 160 }}
              options={priorityOptions}
            />
            <Button
              onClick={() => {
                setSearchInput("");
                setFilterCustomer("");
                setFilterStatus("");
                setFilterPriority("");
              }}
            >
              Clear
            </Button>
          </Space>
          <Table
            rowKey="id"
            loading={loading}
            dataSource={filteredJobs}
            columns={isTechnicianView ? technicianColumns : columns}
            scroll={isTechnicianView ? undefined : { x: 980 }}
            pagination={{ pageSize: isTechnicianView ? 8 : 10, showSizeChanger: true }}
            locale={{ emptyText: "No jobs yet. Create one to start tracking work." }}
          />
        </Card>
      </div>

      <Drawer
        title="Job details"
        open={!!detailJob}
        onClose={() => setDetailJob(null)}
        width={520}
        extra={
          detailJob ? (
            <Space>
              {canManageJobs ? <Button onClick={() => startEdit(detailJob)}>Edit</Button> : null}
              <Button
                type="primary"
                onClick={() =>
                  navigate("/requests", {
                    state: { jobId: detailJob.id, customerId: detailJob.customer_id }
                  })
                }
              >
                Create request
              </Button>
            </Space>
          ) : null
        }
      >
        {detailJob ? (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <div>
              <Typography.Text type="secondary">Title</Typography.Text>
              <div>{detailJob.title}</div>
            </div>
            <div>
              <Typography.Text type="secondary">Customer</Typography.Text>
              <div>{customerNameById.get(detailJob.customer_id) ?? detailJob.customer_id}</div>
            </div>
            <div>
              <Typography.Text type="secondary">Status</Typography.Text>
              <div>{statusLabel(detailJob.status)}</div>
            </div>
            <div>
              <Typography.Text type="secondary">Priority</Typography.Text>
              <div>{statusLabel(detailJob.priority)}</div>
            </div>
            <div>
              <Typography.Text type="secondary">Assigned to</Typography.Text>
              <div>
                {detailJob.assigned_to_user_id
                  ? userNameById.get(detailJob.assigned_to_user_id) ?? "Assigned user unavailable"
                  : "Unassigned"}
              </div>
            </div>
            <div>
              <Typography.Text type="secondary">Site</Typography.Text>
              <div>
                {detailJob.site_location_label || "No label"}{" "}
                {detailJob.site_latitude != null && detailJob.site_longitude != null
                  ? `(${Number(detailJob.site_latitude).toFixed(6)}, ${Number(detailJob.site_longitude).toFixed(6)})`
                  : ""}
              </div>
            </div>
            <div>
              <Typography.Text type="secondary">Description</Typography.Text>
              <div>{detailJob.description || "No description"}</div>
            </div>
          </Space>
        ) : null}
      </Drawer>

      <Modal
        title="Edit job"
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={handleUpdate}
        okText="Save"
        confirmLoading={saving}
      >
        <Form layout="vertical">
          <Form.Item label="Customer" required>
            <Select<number>
              value={editCustomerId === "" ? undefined : editCustomerId}
              onChange={(value) => setEditCustomerId(value)}
              placeholder="Select..."
            >
              {customers.map((c) => (
                <Select.Option key={c.id} value={c.id}>
                  {c.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Title" required>
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </Form.Item>
          <Form.Item label="Description">
            <Input.TextArea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4} />
          </Form.Item>
          <Form.Item label="Site label (optional)">
            <Input value={editSiteLocationLabel} onChange={(e) => setEditSiteLocationLabel(e.target.value)} placeholder="e.g. Pump station A" />
          </Form.Item>
          <Space style={{ width: "100%" }} wrap>
            <Form.Item label="Site latitude" required style={{ minWidth: 220, flex: 1 }}>
              <InputNumber
                style={{ width: "100%" }}
                value={editSiteLatitude}
                onChange={(value) => setEditSiteLatitude(value == null ? null : Number(value))}
                step={0.000001}
              />
            </Form.Item>
            <Form.Item label="Site longitude" required style={{ minWidth: 220, flex: 1 }}>
              <InputNumber
                style={{ width: "100%" }}
                value={editSiteLongitude}
                onChange={(value) => setEditSiteLongitude(value == null ? null : Number(value))}
                step={0.000001}
              />
            </Form.Item>
          </Space>
          <Form.Item label="Status">
            <Select value={editStatus} onChange={(value) => setEditStatus(value)} options={statusOptions} />
          </Form.Item>
          <Form.Item label="Priority">
            <Select value={editPriority} onChange={(value) => setEditPriority(value)} options={priorityOptions} />
          </Form.Item>
          {canManageJobs ? (
            <Form.Item label="Assign to">
              <Select<number>
                allowClear
                value={editAssignedTo === "" ? undefined : editAssignedTo}
                onChange={(value) => setEditAssignedTo(value ?? "")}
                placeholder="Unassigned"
              >
                {users.map((u) => (
                  <Select.Option key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </div>
  );
}

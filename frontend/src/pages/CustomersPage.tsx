import React, { useEffect, useMemo, useState } from "react";
import { App as AntdApp, Button, Card, Drawer, Form, Input, Modal, Space, Table, Typography } from "antd";
import { createCustomer, listCustomers, updateCustomer } from "../api/customers";
import { listJobs } from "../api/jobs";
import type { Customer, Job } from "../api/types";
import { getApiErrorMessage } from "../api/error";
import { formatDateTime } from "../utils/datetime";

export default function CustomersPage() {
  const { message } = AntdApp.useApp();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);

  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [editName, setEditName] = useState("");
  const [editContactName, setEditContactName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [c, j] = await Promise.all([listCustomers(), listJobs()]);
      setCustomers(c);
      setJobs(j);
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to load customers"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    try {
      await createCustomer({
        name: name.trim(),
        contact_name: contactName.trim() ? contactName.trim() : null,
        phone: phone.trim() ? phone.trim() : null,
        email: email.trim() ? email.trim() : null,
        address: address.trim() ? address.trim() : null,
        notes: notes.trim() ? notes.trim() : null
      });
      setName("");
      setContactName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setNotes("");
      message.success("Customer created");
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to create customer"));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(customer: Customer) {
    setEditing(customer);
    setEditName(customer.name);
    setEditContactName(customer.contact_name ?? "");
    setEditPhone(customer.phone ?? "");
    setEditEmail(customer.email ?? "");
    setEditAddress(customer.address ?? "");
    setEditNotes(customer.notes ?? "");
  }

  async function handleUpdate() {
    if (!editing) return;
    setError(null);
    if (!editName.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    try {
      await updateCustomer(editing.id, {
        name: editName.trim(),
        contact_name: editContactName.trim() ? editContactName.trim() : null,
        phone: editPhone.trim() ? editPhone.trim() : null,
        email: editEmail.trim() ? editEmail.trim() : null,
        address: editAddress.trim() ? editAddress.trim() : null,
        notes: editNotes.trim() ? editNotes.trim() : null
      });
      message.success("Customer updated");
      setEditing(null);
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to update customer"));
    } finally {
      setSaving(false);
    }
  }

  const filteredCustomers = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.contact_name, customer.email, customer.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [customers, searchInput]);

  const jobsByCustomer = useMemo(() => {
    const map = new Map<number, Job[]>();
    jobs.forEach((job) => {
      const list = map.get(job.customer_id) ?? [];
      list.push(job);
      map.set(job.customer_id, list);
    });
    return map;
  }, [jobs]);

  const columns = useMemo(
    () => [
      {
        title: "Name",
        dataIndex: "name",
        key: "name",
        sorter: (a: Customer, b: Customer) => a.name.localeCompare(b.name)
      },
      {
        title: "Contact",
        dataIndex: "contact_name",
        key: "contact_name",
        sorter: (a: Customer, b: Customer) => (a.contact_name || "").localeCompare(b.contact_name || "")
      },
      {
        title: "Phone",
        dataIndex: "phone",
        key: "phone",
        sorter: (a: Customer, b: Customer) => (a.phone || "").localeCompare(b.phone || "")
      },
      {
        title: "Email",
        dataIndex: "email",
        key: "email",
        sorter: (a: Customer, b: Customer) => (a.email || "").localeCompare(b.email || "")
      },
      {
        title: "Created",
        dataIndex: "created_at",
        key: "created_at",
        render: (value: string) => formatDateTime(value),
        sorter: (a: Customer, b: Customer) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      },
      {
        title: "Updated",
        dataIndex: "updated_at",
        key: "updated_at",
        render: (value: string) => formatDateTime(value),
        sorter: (a: Customer, b: Customer) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      },
      {
        title: "Actions",
        key: "actions",
        render: (_: unknown, record: Customer) => (
          <Space>
            <Button onClick={() => setDetailCustomer(record)}>View</Button>
            <Button onClick={() => startEdit(record)}>Edit</Button>
          </Space>
        )
      }
    ],
    []
  );

  const jobColumns = useMemo(
    () => [
      { title: "ID", dataIndex: "id", key: "id" },
      { title: "Title", dataIndex: "title", key: "title" },
      { title: "Status", dataIndex: "status", key: "status" },
      { title: "Priority", dataIndex: "priority", key: "priority" },
      { title: "Created", dataIndex: "created_at", key: "created_at", render: (value: string) => formatDateTime(value) },
      { title: "Updated", dataIndex: "updated_at", key: "updated_at", render: (value: string) => formatDateTime(value) }
    ],
    []
  );

  const detailJobs = detailCustomer ? jobsByCustomer.get(detailCustomer.id) ?? [] : [];

  return (
    <div className="container page-shell">
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Customers
      </Typography.Title>
      <Space>
        <Button onClick={() => setShowCreateForm((prev) => !prev)}>
          {showCreateForm ? "Hide Add Customer" : "Add New Customer"}
        </Button>
      </Space>
      <div className="grid">
        {showCreateForm ? (
        <Card title="Add customer">
          <Form layout="vertical" onFinish={handleCreate}>
            <Form.Item label="Name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Form.Item>
            <Form.Item label="Contact">
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </Form.Item>
            <Form.Item label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Form.Item>
            <Form.Item label="Email">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </Form.Item>
            <Form.Item label="Address">
              <Input.TextArea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
            </Form.Item>
            <Form.Item label="Notes">
              <Input.TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </Form.Item>
            <Button type="primary" htmlType="submit" disabled={saving}>
              Create
            </Button>
          </Form>
          {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
        </Card>
        ) : null}

        <Card
          title="Customer list"
          extra={
            <Button onClick={refresh} disabled={loading}>
              Refresh
            </Button>
          }
          style={{ gridColumn: "1 / -1" }}
        >
          <Space style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, contact, phone, or email"
              style={{ maxWidth: 320 }}
            />
          </Space>
          <Table
            rowKey="id"
            loading={loading}
            dataSource={filteredCustomers}
            columns={columns}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            locale={{ emptyText: "No customers yet. Use the form to add your first customer." }}
          />
        </Card>
      </div>

      <Drawer
        title="Customer details"
        open={!!detailCustomer}
        onClose={() => setDetailCustomer(null)}
        width={520}
        extra={
          detailCustomer ? (
            <Button onClick={() => startEdit(detailCustomer)}>
              Edit
            </Button>
          ) : null
        }
      >
        {detailCustomer ? (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <div>
              <Typography.Text type="secondary">Name</Typography.Text>
              <div>{detailCustomer.name}</div>
            </div>
            <div>
              <Typography.Text type="secondary">Contact</Typography.Text>
              <div>{detailCustomer.contact_name || "Not set"}</div>
            </div>
            <div>
              <Typography.Text type="secondary">Phone</Typography.Text>
              <div>{detailCustomer.phone || "Not set"}</div>
            </div>
            <div>
              <Typography.Text type="secondary">Email</Typography.Text>
              <div>{detailCustomer.email || "Not set"}</div>
            </div>
            <div>
              <Typography.Text type="secondary">Address</Typography.Text>
              <div>{detailCustomer.address || "Not set"}</div>
            </div>
            <div>
              <Typography.Text type="secondary">Notes</Typography.Text>
              <div>{detailCustomer.notes || "No notes"}</div>
            </div>

            <div>
              <Typography.Title level={5} style={{ marginBottom: 8 }}>
                Job history
              </Typography.Title>
              <Table
                rowKey="id"
                dataSource={detailJobs}
                columns={jobColumns}
                pagination={false}
                size="small"
                locale={{ emptyText: "No jobs linked to this customer yet." }}
              />
            </div>
          </Space>
        ) : null}
      </Drawer>

      <Modal
        title="Edit customer"
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={handleUpdate}
        okText="Save"
        confirmLoading={saving}
      >
        <Form layout="vertical">
          <Form.Item label="Name" required>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </Form.Item>
          <Form.Item label="Contact">
            <Input value={editContactName} onChange={(e) => setEditContactName(e.target.value)} />
          </Form.Item>
          <Form.Item label="Phone">
            <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
          </Form.Item>
          <Form.Item label="Email">
            <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
          </Form.Item>
          <Form.Item label="Address">
            <Input.TextArea value={editAddress} onChange={(e) => setEditAddress(e.target.value)} rows={2} />
          </Form.Item>
          <Form.Item label="Notes">
            <Input.TextArea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

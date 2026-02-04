import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Checkbox, Form, Input, Space, Table, Tag, Typography } from "antd";
import { createSupplier, deactivateSupplier, listSuppliers, updateSupplier } from "../api/suppliers";
import type { Supplier } from "../api/types";
import { getApiErrorMessage } from "../api/error";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await listSuppliers({ q: q || undefined, include_inactive: includeInactive });
      setSuppliers(data);
    } catch (err: any) {
      setListError(getApiErrorMessage(err, "Failed to load suppliers"));
    } finally {
      setLoading(false);
    }
  }, [includeInactive, q]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeCount = useMemo(() => suppliers.filter((s) => s.is_active).length, [suppliers]);

  const [editing, setEditing] = useState<Supplier | null>(null);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function resetForm() {
    setEditing(null);
    setName("");
    setContactName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setFormError(null);
  }

  function startEdit(supplier: Supplier) {
    setEditing(supplier);
    setName(supplier.name);
    setContactName(supplier.contact_name ?? "");
    setPhone(supplier.phone ?? "");
    setEmail(supplier.email ?? "");
    setNotes(supplier.notes ?? "");
    setFormError(null);
  }

  async function handleSave() {
    setFormError(null);

    const nameValue = name.trim();
    if (!nameValue) {
      setFormError("Supplier name is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: nameValue,
        contact_name: contactName.trim() ? contactName.trim() : null,
        phone: phone.trim() ? phone.trim() : null,
        email: email.trim() ? email.trim() : null,
        notes: notes.trim() ? notes.trim() : null
      };

      if (editing) {
        await updateSupplier(editing.id, payload);
      } else {
        await createSupplier(payload);
      }
      resetForm();
      await refresh();
    } catch (err: any) {
      setFormError(getApiErrorMessage(err, "Failed to save supplier"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(supplier: Supplier) {
    setListError(null);
    try {
      if (supplier.is_active) {
        const ok = window.confirm(`Deactivate supplier "${supplier.name}"?`);
        if (!ok) return;
        await deactivateSupplier(supplier.id);
      } else {
        await updateSupplier(supplier.id, { is_active: true });
      }
      await refresh();
    } catch (err: any) {
      setListError(getApiErrorMessage(err, "Failed to update supplier"));
    }
  }

  const columns = useMemo(
    () => [
      { title: "Name", dataIndex: "name", key: "name" },
      { title: "Contact", dataIndex: "contact_name", key: "contact_name" },
      { title: "Phone", dataIndex: "phone", key: "phone" },
      { title: "Email", dataIndex: "email", key: "email" },
      {
        title: "Status",
        dataIndex: "is_active",
        key: "is_active",
        render: (value: boolean) => (value ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>)
      },
      {
        title: "Actions",
        key: "actions",
        render: (_: unknown, supplier: Supplier) => (
          <Space>
            <Button onClick={() => startEdit(supplier)} disabled={saving}>
              Edit
            </Button>
            <Button onClick={() => toggleActive(supplier)} disabled={saving}>
              {supplier.is_active ? "Deactivate" : "Reactivate"}
            </Button>
          </Space>
        )
      }
    ],
    [saving]
  );

  return (
    <div className="container">
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Suppliers
      </Typography.Title>
      <Space style={{ marginBottom: 12 }} size="middle">
        <Typography.Text type="secondary">
          {loading ? "Loading..." : `${activeCount} active supplier${activeCount === 1 ? "" : "s"}`}
        </Typography.Text>
        <Button onClick={refresh} disabled={loading}>
          Refresh
        </Button>
      </Space>

      <div className="grid">
        <Card title={editing ? "Edit supplier" : "Add supplier"}>
          <Form layout="vertical" onFinish={handleSave}>
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
            <Form.Item label="Notes">
              <Input.TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </Form.Item>

            {formError ? <Typography.Text type="danger">{formError}</Typography.Text> : null}

            <Space style={{ marginTop: 12 }}>
              <Button type="primary" htmlType="submit" disabled={saving}>
                {editing ? "Save changes" : "Create supplier"}
              </Button>
              {editing ? (
                <Button onClick={resetForm} disabled={saving}>
                  Cancel
                </Button>
              ) : null}
            </Space>
          </Form>
        </Card>

        <Card
          title="Supplier list"
          extra={
            <Checkbox checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)}>
              Include inactive
            </Checkbox>
          }
        >
          <Form
            layout="inline"
            onFinish={() => setQ(searchInput.trim())}
            style={{ marginBottom: 12, flexWrap: "wrap" }}
          >
            <Form.Item label="Search">
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name or contact"
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button htmlType="submit" disabled={loading}>
                  Search
                </Button>
                <Button
                  onClick={() => {
                    setSearchInput("");
                    setQ("");
                  }}
                  disabled={loading && suppliers.length === 0}
                >
                  Clear
                </Button>
              </Space>
            </Form.Item>
          </Form>

          {listError ? <Typography.Text type="danger">{listError}</Typography.Text> : null}

          <Table
            rowKey="id"
            loading={loading}
            dataSource={suppliers}
            columns={columns}
            pagination={false}
            locale={{ emptyText: "No suppliers found." }}
          />
        </Card>
      </div>
    </div>
  );
}

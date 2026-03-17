import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, Space, Table, Tag, Typography } from "antd";
import { createLocation, listLocations, updateLocation } from "../api/locations";
import type { Location } from "../api/types";
import { getApiErrorMessage } from "../api/error";
import { formatDateTime } from "../utils/datetime";

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Location | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setLocations(await listLocations({ include_inactive: true }));
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to load locations"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function resetForm() {
    setEditing(null);
    setName("");
    setDescription("");
    setError(null);
    setShowForm(false);
  }

  function startEdit(location: Location) {
    setShowForm(true);
    setEditing(location);
    setName(location.name);
    setDescription(location.description ?? "");
    setError(null);
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Location name is required");
      return;
    }
    try {
      const payload = { name: name.trim(), description: description.trim() || null };
      if (editing) {
        await updateLocation(editing.id, payload);
      } else {
        await createLocation(payload);
      }
      resetForm();
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to save location"));
    }
  }

  async function toggleActive(location: Location) {
    try {
      await updateLocation(location.id, { is_active: !location.is_active });
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to update location"));
    }
  }

  const columns = useMemo(
    () => [
      { title: "Name", dataIndex: "name", key: "name" },
      { title: "Description", dataIndex: "description", key: "description" },
      {
        title: "Status",
        dataIndex: "is_active",
        key: "is_active",
        render: (value: boolean) => (value ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>)
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
        render: (_: unknown, location: Location) => (
          <Space>
            <Button onClick={() => startEdit(location)}>Edit</Button>
            <Button onClick={() => toggleActive(location)}>{location.is_active ? "Deactivate" : "Activate"}</Button>
          </Space>
        )
      }
    ],
    []
  );

  return (
    <div className="container page-shell">
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Locations
      </Typography.Title>
      <Space>
        <Button
          onClick={() => {
            if (showForm && !editing) {
              resetForm();
              return;
            }
            setShowForm((prev) => !prev);
          }}
        >
          {showForm ? (editing ? "Editing Location" : "Hide Add Location") : "Add New Location"}
        </Button>
      </Space>
      <div className="grid">
        {showForm ? (
        <Card title={editing ? "Edit location" : "Add location"}>
          <Form layout="vertical" onFinish={handleSave}>
            <Form.Item label="Name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Form.Item>
            <Form.Item label="Description">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editing ? "Save changes" : "Create"}
              </Button>
              <Button onClick={resetForm}>Cancel</Button>
            </Space>
          </Form>
          {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
        </Card>
        ) : null}

        <Card
          title="Location list"
          extra={
            <Button onClick={refresh} disabled={loading}>
              Refresh
            </Button>
          }
          style={{ gridColumn: "1 / -1" }}
        >
          <Table
            rowKey="id"
            loading={loading}
            dataSource={locations}
            columns={columns}
            pagination={false}
            locale={{ emptyText: "No locations yet." }}
          />
        </Card>
      </div>
    </div>
  );
}

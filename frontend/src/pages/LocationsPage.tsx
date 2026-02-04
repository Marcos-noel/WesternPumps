import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, Table, Tag, Typography } from "antd";
import { createLocation, listLocations, updateLocation } from "../api/locations";
import type { Location } from "../api/types";
import { getApiErrorMessage } from "../api/error";

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

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

  async function handleCreate() {
    setError(null);
    if (!name.trim()) {
      setError("Location name is required");
      return;
    }
    try {
      await createLocation({ name: name.trim(), description: description.trim() || null });
      setName("");
      setDescription("");
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to create location"));
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
        title: "Actions",
        key: "actions",
        render: (_: unknown, location: Location) => (
          <Button onClick={() => toggleActive(location)}>{location.is_active ? "Deactivate" : "Activate"}</Button>
        )
      }
    ],
    []
  );

  return (
    <div className="container">
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Locations
      </Typography.Title>
      <div className="grid">
        <Card title="Add location">
          <Form layout="vertical" onFinish={handleCreate}>
            <Form.Item label="Name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Form.Item>
            <Form.Item label="Description">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </Form.Item>
            <Button type="primary" htmlType="submit">
              Create
            </Button>
          </Form>
          {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
        </Card>

        <Card
          title="Location list"
          extra={
            <Button onClick={refresh} disabled={loading}>
              Refresh
            </Button>
          }
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

import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, Select, Table, Typography } from "antd";
import { createUser, listUsers } from "../api/users";
import type { User, UserRole } from "../api/types";
import { getApiErrorMessage } from "../api/error";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("staff");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setUsers(await listUsers());
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate() {
    setError(null);
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setCreating(true);
    try {
      await createUser({
        email: email.trim(),
        password,
        full_name: fullName.trim() ? fullName.trim() : null,
        role
      });
      setEmail("");
      setPassword("");
      setFullName("");
      setRole("staff");
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to create user"));
    } finally {
      setCreating(false);
    }
  }

  const columns = useMemo(
    () => [
      { title: "ID", dataIndex: "id", key: "id" },
      { title: "Email", dataIndex: "email", key: "email" },
      { title: "Name", dataIndex: "full_name", key: "full_name" },
      { title: "Role", dataIndex: "role", key: "role" },
      { title: "Active", dataIndex: "is_active", key: "is_active", render: (value: boolean) => (value ? "Yes" : "No") }
    ],
    []
  );

  return (
    <div className="container">
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Users
      </Typography.Title>
      <div className="grid">
        <Card title="Create user">
          <Form layout="vertical" onFinish={handleCreate}>
            <Form.Item label="Email" required>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Form.Item>
            <Form.Item label="Password" required>
              <Input.Password value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />
            </Form.Item>
            <Form.Item label="Full name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Optional" />
            </Form.Item>
            <Form.Item label="Role" required>
              <Select<UserRole> value={role} onChange={(value) => setRole(value)}>
                <Select.Option value="staff">Technician</Select.Option>
                <Select.Option value="store_manager">Store Manager</Select.Option>
                <Select.Option value="manager">Manager</Select.Option>
                <Select.Option value="approver">Approver</Select.Option>
                <Select.Option value="admin">Admin</Select.Option>
              </Select>
            </Form.Item>
            <Button type="primary" htmlType="submit" disabled={creating}>
              Create
            </Button>
          </Form>
          {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
          <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
            Only admins can create users.
          </Typography.Text>
        </Card>

        <Card
          title="User list"
          extra={
            <Button onClick={refresh} disabled={loading}>
              Refresh
            </Button>
          }
        >
          <Table
            rowKey="id"
            loading={loading}
            dataSource={users}
            columns={columns}
            pagination={false}
            locale={{ emptyText: "No users yet." }}
          />
        </Card>
      </div>
    </div>
  );
}

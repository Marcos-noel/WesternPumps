import React, { useEffect, useMemo, useState } from "react";
import { App as AntdApp, Button, Card, Dropdown, Form, Input, Modal, Select, Space, Table, Typography } from "antd";
import type { MenuProps } from "antd";
import { MoreOutlined } from "@ant-design/icons";
import { forgotPassword } from "../api/auth";
import {
  adminResetUserPassword,
  createUser,
  deactivateUser,
  hardDeleteUser,
  listUsers,
  reactivateUser,
  updateUser
} from "../api/users";
import type { User, UserRole } from "../api/types";
import { getApiErrorMessage } from "../api/error";
import { useAuth } from "../state/AuthContext";
import { formatDateTime } from "../utils/datetime";
import { validatePasswordPolicy } from "../utils/passwordPolicy";

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "technician", label: "Technician" },
  { value: "lead_technician", label: "Lead Technician" },
  { value: "store_manager", label: "Store Manager" },
  { value: "manager", label: "Manager" },
  { value: "approver", label: "Approver" },
  { value: "finance", label: "Finance" },
  { value: "rider", label: "Rider" },
  { value: "driver", label: "Driver" },
  { value: "admin", label: "Admin" }
];

export default function UsersPage() {
  const { message } = AntdApp.useApp();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("technician");
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<User | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("technician");
  const [editingSave, setEditingSave] = useState(false);

  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);

  const [showCreateUserForm, setShowCreateUserForm] = useState(false);

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
    const createPasswordError = validatePasswordPolicy(password);
    if (createPasswordError) {
      setError(createPasswordError);
      return;
    }
    setCreating(true);
    try {
      await createUser({
        email: email.trim(),
        phone: phone.trim() ? phone.trim() : null,
        password,
        full_name: fullName.trim() ? fullName.trim() : null,
        role
      });
      setEmail("");
      setPhone("");
      setPassword("");
      setFullName("");
      setRole("technician");
      message.success("User created");
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to create user"));
    } finally {
      setCreating(false);
    }
  }

  function openEdit(user: User) {
    setEditing(user);
    setEditPhone(user.phone ?? "");
    setEditName(user.full_name ?? "");
    setEditRole((user.role as UserRole) ?? "technician");
  }

  async function handleUpdate() {
    if (!editing) return;
    setEditingSave(true);
    try {
      await updateUser(editing.id, {
        phone: editPhone.trim() ? editPhone.trim() : null,
        full_name: editName.trim() ? editName.trim() : null,
        role: editRole
      });
      message.success("User updated");
      setEditing(null);
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to update user"));
    } finally {
      setEditingSave(false);
    }
  }

  async function handleDeactivate(user: User) {
    try {
      await deactivateUser(user.id);
      message.success("User deactivated");
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to deactivate user"));
    }
  }

  async function handleReactivate(user: User) {
    try {
      await reactivateUser(user.id);
      message.success("User reactivated");
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to reactivate user"));
    }
  }

  async function handleHardDelete(user: User) {
    try {
      await hardDeleteUser(user.id);
      message.success("User deleted");
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to delete user"));
    }
  }

  function openResetPassword(user: User) {
    setError(null);
    setResettingUser(user);
    setResetPassword("");
  }

  async function handleResetPassword() {
    if (!resettingUser) return;
    const policyError = validatePasswordPolicy(resetPassword);
    if (policyError) {
      setError(policyError);
      return;
    }
    setResetSaving(true);
    try {
      await adminResetUserPassword(resettingUser.id, resetPassword);
      message.success("Password reset");
      setResettingUser(null);
      setResetPassword("");
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to reset password"));
    } finally {
      setResetSaving(false);
    }
  }

  async function handleSendResetEmail(user: User) {
    try {
      await forgotPassword(user.email);
      message.success(`Reset email sent to ${user.email}`);
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to send reset email"));
    }
  }

  const columns = useMemo(
    () => [
      { title: "ID", dataIndex: "id", key: "id" },
      { title: "Email", dataIndex: "email", key: "email" },
      { title: "Phone", dataIndex: "phone", key: "phone", render: (v: string | null) => v || "-" },
      { title: "Name", dataIndex: "full_name", key: "full_name", render: (v: string | null) => v || "-" },
      {
        title: "Role",
        dataIndex: "role",
        key: "role",
        render: (value: string) => (value === "staff" ? "technician" : value)
      },
      { title: "Active", dataIndex: "is_active", key: "is_active", render: (value: boolean) => (value ? "Yes" : "No") },
      { title: "Created", dataIndex: "created_at", key: "created_at", render: (value: string) => formatDateTime(value) },
      { title: "Updated", dataIndex: "updated_at", key: "updated_at", render: (value: string) => formatDateTime(value) },
      {
        title: "Actions",
        key: "actions",
        width: 140,
        render: (_: unknown, row: User) => {
          const isSelf = row.id === currentUser?.id;
          const menuItems: MenuProps["items"] = [
            { key: "edit", label: "Edit", onClick: () => openEdit(row) },
            { key: "change_password", label: "Change password", onClick: () => openResetPassword(row) },
            { key: "forgot_password", label: "Send reset email", onClick: () => handleSendResetEmail(row) },
            row.is_active
              ? {
                  key: "deactivate",
                  label: "Deactivate",
                  danger: true,
                  disabled: isSelf,
                  onClick: () =>
                    Modal.confirm({
                      title: "Deactivate user?",
                      content: "This disables login for this user.",
                      okText: "Deactivate",
                      okButtonProps: { danger: true },
                      onOk: () => handleDeactivate(row)
                    })
                }
              : {
                  key: "reactivate",
                  label: "Reactivate",
                  disabled: isSelf,
                  onClick: () => handleReactivate(row)
                },
            {
              key: "delete",
              label: "Delete",
              danger: true,
              disabled: isSelf,
              onClick: () =>
                Modal.confirm({
                  title: "Permanently delete user?",
                  content: "This cannot be undone. Use deactivate if unsure.",
                  okText: "Delete",
                  okButtonProps: { danger: true },
                  onOk: () => handleHardDelete(row)
                })
            }
          ];
          return (
            <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
              <Button icon={<MoreOutlined />}>Manage</Button>
            </Dropdown>
          );
        }
      }
    ],
    [currentUser?.id]
  );

  return (
    <div className="container page-shell">
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Users
      </Typography.Title>
      <Space>
        <Button onClick={() => setShowCreateUserForm((prev) => !prev)}>
          {showCreateUserForm ? "Hide Add User" : "Add New User"}
        </Button>
      </Space>
      <div className="grid">
        {showCreateUserForm ? (
        <Card title="Create user">
          <Form layout="vertical" onFinish={handleCreate}>
            <Form.Item label="Email" required>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Form.Item>
            <Form.Item label="Phone number">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2547..." />
            </Form.Item>
            <Form.Item label="Password" required>
              <Input.Password value={password} onChange={(e) => setPassword(e.target.value)} minLength={10} />
            </Form.Item>
            <Form.Item label="Full name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Optional" />
            </Form.Item>
            <Form.Item label="Role" required>
              <Select<UserRole> value={role} onChange={(value) => setRole(value)} options={ROLE_OPTIONS} />
            </Form.Item>
            <Button type="primary" htmlType="submit" disabled={creating}>
              Create
            </Button>
          </Form>
          {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
          <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
            Admins can create, edit, deactivate, and delete users.
          </Typography.Text>
        </Card>
        ) : null}

        <Card
          title="User list"
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
            dataSource={users}
            columns={columns}
            pagination={{ pageSize: 12, showSizeChanger: true }}
            locale={{ emptyText: "No users yet." }}
          />
        </Card>
      </div>

      <Modal
        title="Edit user profile"
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={handleUpdate}
        okText="Save"
        confirmLoading={editingSave}
      >
        <Form layout="vertical">
          <Form.Item label="Phone number">
            <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+2547..." />
          </Form.Item>
          <Form.Item label="Full name">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </Form.Item>
          <Form.Item label="Role" required>
            <Select<UserRole> value={editRole} onChange={(value) => setEditRole(value)} options={ROLE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={resettingUser ? `Change password: ${resettingUser.email}` : "Change user password"}
        open={!!resettingUser}
        onCancel={() => setResettingUser(null)}
        onOk={handleResetPassword}
        okText="Reset"
        confirmLoading={resetSaving}
      >
        <Form layout="vertical">
          <Form.Item label="New password" required>
            <Input.Password value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} minLength={10} />
          </Form.Item>
          <Typography.Text type="secondary">
            Use 10+ chars with uppercase, lowercase, number, and symbol.
          </Typography.Text>
        </Form>
      </Modal>
    </div>
  );
}

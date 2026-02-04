import React, { useState } from "react";
import { Alert, Button, Card, Form, Input, Space, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { bootstrapAdmin } from "../api/auth";
import { getApiErrorMessage } from "../api/error";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const disableAuth = import.meta.env.VITE_DISABLE_AUTH === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const bootstrapCompleted = Boolean(error && error.toLowerCase().includes("bootstrap already completed"));

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate("/customers");
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleBootstrap() {
    if (disableAuth) return;
    setError(null);
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await bootstrapAdmin(email.trim(), password, fullName);
      await login(email.trim(), password);
      navigate("/customers");
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Bootstrap failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Login
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {disableAuth ? "Login is disabled (dev mode)." : "Use Bootstrap Admin once when no admin exists yet."}
      </Typography.Paragraph>

      <Card>
        <Form layout="vertical" onFinish={handleLogin}>
          <Form.Item label="Email" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@westernpumps.com"
            />
          </Form.Item>
          <Form.Item label="Password" required>
            <Input.Password
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              minLength={8}
            />
          </Form.Item>
          <Form.Item label="Full name (bootstrap only)">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Western Pumps Admin" />
          </Form.Item>

          {error ? <Alert type="error" message={error} showIcon /> : null}
          {bootstrapCompleted ? (
            <Space direction="vertical" size="small" style={{ display: "flex", marginTop: 8 }}>
              <Typography.Text type="secondary">
                If you don&apos;t know the existing admin credentials, either reset the database or reset the admin
                password.
              </Typography.Text>
              <Typography.Text type="secondary">
                Docker reset: <Typography.Text code>docker compose down -v</Typography.Text>
              </Typography.Text>
              <Typography.Text type="secondary">
                Password reset:{" "}
                <Typography.Text code>
                  backend\.venv\Scripts\python.exe -B backend\scripts\reset_user_password.py --email
                  &quot;admin@westernpumps.com&quot; --password &quot;NEW_PASSWORD_HERE&quot;
                </Typography.Text>
              </Typography.Text>
            </Space>
          ) : null}

          <Space style={{ marginTop: 12 }}>
            {!disableAuth ? (
              <>
                <Button type="primary" htmlType="submit" loading={loading}>
                  Login
                </Button>
                <Button onClick={handleBootstrap} loading={loading}>
                  Bootstrap Admin
                </Button>
              </>
            ) : (
              <Button onClick={() => navigate("/customers")}>Continue</Button>
            )}
          </Space>
        </Form>
      </Card>
    </div>
  );
}

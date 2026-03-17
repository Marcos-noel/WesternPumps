import React, { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input, Space, Typography } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { bootstrapAdmin, forgotPassword, resetPassword } from "../api/auth";
import { getApiErrorMessage } from "../api/error";
import logoMark from "../assets/image.png";
import { getBrandingSettings } from "../api/settings";
import BrandedLoader from "../components/BrandedLoader";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const disableAuth = import.meta.env.VITE_DISABLE_AUTH === "true";
  const enableBootstrap = import.meta.env.VITE_ENABLE_AUTH_BOOTSTRAP === "true";
  const resetToken = searchParams.get("reset_token");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirectLoading, setRedirectLoading] = useState(false);
  const [brandingLogoUrl, setBrandingLogoUrl] = useState("");
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const logoSrc = !logoLoadFailed && brandingLogoUrl ? brandingLogoUrl : logoMark;

  useEffect(() => {
    let mounted = true;
    getBrandingSettings()
      .then((res) => {
        if (!mounted) return;
        setLogoLoadFailed(false);
        setBrandingLogoUrl(res.branding_logo_url || "");
      })
      .catch(() => {
        if (!mounted) return;
        setLogoLoadFailed(false);
        setBrandingLogoUrl("");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const bootstrapCompleted = Boolean(error && error.toLowerCase().includes("bootstrap already completed"));

  async function handleLogin() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      sessionStorage.setItem("wp_show_welcome_loader", "1");
      setRedirectLoading(true);
      navigate("/dashboard");
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleBootstrap() {
    if (disableAuth) return;
    setError(null);
    setSuccess(null);
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (password.length < 10) {
      setError("Password must be at least 10 characters");
      return;
    }
    setLoading(true);
    try {
      await bootstrapAdmin(email.trim(), password, fullName);
      await login(email.trim(), password);
      sessionStorage.setItem("wp_show_welcome_loader", "1");
      setRedirectLoading(true);
      navigate("/dashboard");
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Bootstrap failed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError(null);
    setSuccess(null);
    if (!forgotEmail.trim()) {
      setError("Enter your account email");
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(forgotEmail.trim());
      setSuccess("If the account exists, a password reset link has been sent.");
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to start password reset"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setError(null);
    setSuccess(null);
    if (!resetToken) {
      setError("Reset token is missing");
      return;
    }
    if (newPassword.length < 10) {
      setError("New password must be at least 10 characters");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(resetToken, newPassword);
      setSuccess("Password reset successful. You can now log in.");
      setNewPassword("");
      setConfirmNewPassword("");
      const next = new URLSearchParams(searchParams);
      next.delete("reset_token");
      setSearchParams(next, { replace: true });
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to reset password"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
    {redirectLoading ? (
      <div className="app-welcome-overlay">
        <BrandedLoader title="Welcome to Western Pumps" subtitle="Signing you in..." />
      </div>
    ) : null}
    <div className="container" style={{ maxWidth: 520 }}>
      <div className="login-brand">
        <img src={logoSrc} alt="WesternPumps logo" className="login-brand-logo" onError={() => setLogoLoadFailed(true)} />
      </div>
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Login
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {disableAuth
          ? "Login is disabled (dev mode)."
          : enableBootstrap
            ? "Use Bootstrap Admin once when no admin exists yet."
            : "Sign in with your existing account."}
      </Typography.Paragraph>

      <Card>
        {resetToken ? (
          <Form layout="vertical" onFinish={handleResetPassword}>
            <Form.Item label="New password" required>
              <Input.Password
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="********"
                minLength={10}
              />
            </Form.Item>
            <Form.Item label="Confirm new password" required>
              <Input.Password
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="********"
                minLength={10}
              />
            </Form.Item>
            {error ? <Alert type="error" message={error} showIcon /> : null}
            {success ? <Alert type="success" message={success} showIcon /> : null}
            <Space style={{ marginTop: 12 }}>
              <Button type="primary" htmlType="submit" loading={loading}>
                Reset Password
              </Button>
              <Button
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete("reset_token");
                  setSearchParams(next, { replace: true });
                  setError(null);
                }}
              >
                Back to Login
              </Button>
            </Space>
          </Form>
        ) : (
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
              minLength={10}
            />
          </Form.Item>
          {enableBootstrap ? (
            <Form.Item label="Full name (bootstrap only)">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Western Pumps Admin" />
            </Form.Item>
          ) : null}

          {error ? <Alert type="error" message={error} showIcon /> : null}
          {success ? <Alert type="success" message={success} showIcon /> : null}
          {enableBootstrap && bootstrapCompleted ? (
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
                {enableBootstrap ? (
                  <Button onClick={handleBootstrap} loading={loading}>
                    Bootstrap Admin
                  </Button>
                ) : null}
              </>
            ) : (
              <Button onClick={() => navigate("/dashboard")}>Continue</Button>
            )}
          </Space>
          {!disableAuth ? (
            <Space direction="vertical" style={{ display: "flex", marginTop: 18 }}>
              <Typography.Text type="secondary">Forgot password?</Typography.Text>
              <Space.Compact style={{ width: "100%" }}>
                <Input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Enter your email for reset link"
                />
                <Button onClick={handleForgotPassword} loading={loading}>
                  Send Link
                </Button>
              </Space.Compact>
            </Space>
          ) : null}
        </Form>
        )}
      </Card>
    </div>
    </div>
  );
}

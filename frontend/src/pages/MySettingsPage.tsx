import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Form, Input, Select, Space, Spin, Switch, Typography } from "antd";
import { getApiErrorMessage } from "../api/error";
import { getMyPreferences, updateMyPreferences } from "../api/users";
import { useAuth } from "../state/AuthContext";
import { allowedLandingPages } from "../utils/access";

export default function MySettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [defaultLandingPage, setDefaultLandingPage] = useState("/dashboard");
  const [denseMode, setDenseMode] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [showEmailInHeader, setShowEmailInHeader] = useState(true);
  const [displayNameOverride, setDisplayNameOverride] = useState("");

  const landingOptions = useMemo(
    () =>
      allowedLandingPages(user?.role).map((path) => ({
        value: path,
        label: path.replace("/", "").replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Dashboard",
      })),
    [user?.role]
  );

  async function load() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const prefs = await getMyPreferences();
      setDefaultLandingPage(prefs.default_landing_page || "/dashboard");
      setDenseMode(Boolean(prefs.dense_mode));
      setAnimationsEnabled(Boolean(prefs.animations_enabled));
      setShowEmailInHeader(Boolean(prefs.show_email_in_header));
      setDisplayNameOverride(prefs.display_name_override || "");
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to load your settings"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await updateMyPreferences({
        default_landing_page: defaultLandingPage,
        dense_mode: denseMode,
        animations_enabled: animationsEnabled,
        show_email_in_header: showEmailInHeader,
        display_name_override: displayNameOverride.trim() || null,
      });
      setDefaultLandingPage(saved.default_landing_page);
      setDenseMode(Boolean(saved.dense_mode));
      setAnimationsEnabled(Boolean(saved.animations_enabled));
      setShowEmailInHeader(Boolean(saved.show_email_in_header));
      setDisplayNameOverride(saved.display_name_override || "");
      setSuccess("Your settings were saved.");
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to save your settings"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container page-shell">
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        My Settings
      </Typography.Title>
      <Card>
        {loading ? (
          <Space>
            <Spin size="small" />
            <Typography.Text type="secondary">Loading your settings</Typography.Text>
          </Space>
        ) : (
          <Form layout="vertical" onFinish={handleSave}>
            <Typography.Paragraph type="secondary">
              Personalize your workspace. These settings apply only to your account.
            </Typography.Paragraph>

            <Form.Item label="Default landing page">
              <Select value={defaultLandingPage} onChange={setDefaultLandingPage} options={landingOptions} />
            </Form.Item>

            <Form.Item label="Display name override">
              <Input
                value={displayNameOverride}
                onChange={(e) => setDisplayNameOverride(e.target.value)}
                placeholder="Leave blank to use your full name/email"
              />
            </Form.Item>

            <Space direction="vertical" size={10}>
              <Space>
                <Switch checked={denseMode} onChange={setDenseMode} />
                <Typography.Text>Use compact layout density</Typography.Text>
              </Space>
              <Space>
                <Switch checked={animationsEnabled} onChange={setAnimationsEnabled} />
                <Typography.Text>Enable interface animations</Typography.Text>
              </Space>
              <Space>
                <Switch checked={showEmailInHeader} onChange={setShowEmailInHeader} />
                <Typography.Text>Show email in header identity</Typography.Text>
              </Space>
            </Space>

            <Space style={{ marginTop: 16 }}>
              <Button type="primary" htmlType="submit" loading={saving}>
                Save
              </Button>
              <Button onClick={load} disabled={saving}>
                Reload
              </Button>
            </Space>
            {error ? <Alert style={{ marginTop: 12 }} type="error" showIcon message={error} /> : null}
            {success ? <Alert style={{ marginTop: 12 }} type="success" showIcon message={success} /> : null}
          </Form>
        )}
      </Card>
    </div>
  );
}

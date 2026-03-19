import { useEffect, useState } from "react";
import { Card, Row, Col, Statistic, Button, Descriptions, Tag, Space, message, Spin } from "antd";
import { ReloadOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, SyncOutlined } from "@ant-design/icons";
import { platformApi, type OutboxHealth, type ComplianceStatus, type SystemAbout } from "../api/platform";
import { useAuth } from "../state/AuthContext";

export default function PlatformPage() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [outboxHealth, setOutboxHealth] = useState<OutboxHealth | null>(null);
  const [compliance, setCompliance] = useState<ComplianceStatus | null>(null);
  const [systemAbout, setSystemAbout] = useState<SystemAbout | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [outbox, comp, about] = await Promise.all([
        platformApi.getOutboxHealth(),
        platformApi.getComplianceStatus(),
        platformApi.getSystemAbout(),
      ]);
      setOutboxHealth(outbox);
      setCompliance(comp);
      setSystemAbout(about);
    } catch (error) {
      message.error("Failed to load platform data");
    } finally {
      setLoading(false);
    }
  };

  const handleRetryDeadLetters = async () => {
    try {
      if (!isAdmin) {
        message.error("Access denied: only Admin can retry dead letters");
        return;
      }
      const result = await platformApi.retryDeadLetters();
      message.success(`Retried ${result.retried} dead letters`);
      loadAllData();
    } catch (error) {
      message.error("Failed to retry dead letters");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ok":
        return <CheckCircleOutlined style={{ color: "#52c41a" }} />;
      case "attention":
        return <WarningOutlined style={{ color: "#faad14" }} />;
      default:
        return <CloseCircleOutlined style={{ color: "#ff4d4f" }} />;
    }
  };

  return (
    <div className="container page-shell">
      <Row gutter={[12, 12]} align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col xs={24} md={10}>
          <h1 style={{ margin: 0 }}>Platform Operations</h1>
        </Col>
        <Col xs={24} md={14} style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button icon={<ReloadOutlined />} onClick={loadAllData} loading={loading}>
            Refresh
          </Button>
        </Col>
      </Row>

      {loading ? (
        <div style={{ textAlign: "center", padding: 50 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card title="Outbox - Pending">
                <Statistic value={outboxHealth?.pending || 0} valueStyle={{ color: "#1890ff" }} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card title="Outbox - Processing">
                <Statistic value={outboxHealth?.processing || 0} valueStyle={{ color: "#faad14" }} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card title="Outbox - Failed">
                <Statistic value={outboxHealth?.failed || 0} valueStyle={{ color: "#ff4d4f" }} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card title="Outbox - Dead">
                <Statistic value={outboxHealth?.dead || 0} valueStyle={{ color: "#ff4d4f" }} />
              </Card>
            </Col>
          </Row>

          <Card
            title="Outbox Health"
            extra={
              <Button
                type="primary"
                danger
                icon={<SyncOutlined />}
                onClick={handleRetryDeadLetters}
                disabled={!isAdmin || (outboxHealth?.dead || 0) === 0}
              >
                Retry Dead Letters
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            <Descriptions column={{ xs: 1, sm: 2, md: 4 }}>
              <Descriptions.Item label="Done (24h)">{outboxHealth?.done_last_24h || 0}</Descriptions.Item>
              <Descriptions.Item label="Pending">{outboxHealth?.pending || 0}</Descriptions.Item>
              <Descriptions.Item label="Processing">{outboxHealth?.processing || 0}</Descriptions.Item>
              <Descriptions.Item label="Failed">{outboxHealth?.failed || 0}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="Compliance Status" style={{ marginBottom: 16 }}>
            <Space>
              <Tag icon={getStatusIcon(compliance?.status || "unknown")} color={compliance?.status === "ok" ? "success" : "warning"}>
                {compliance?.status?.toUpperCase() || "UNKNOWN"}
              </Tag>
              <span>Generated: {compliance ? new Date(compliance.generated_at).toLocaleString() : "-"}</span>
            </Space>
            <Descriptions column={{ xs: 1, sm: 2, md: 4 }} style={{ marginTop: 16 }}>
              <Descriptions.Item label="Auth Enabled">{compliance?.auth_enabled ? "✓" : "✗"}</Descriptions.Item>
              <Descriptions.Item label="HTTPS Enforced">{compliance?.https_enforced ? "✓" : "✗"}</Descriptions.Item>
              <Descriptions.Item label="Security Headers">{compliance?.security_headers_enabled ? "✓" : "✗"}</Descriptions.Item>
              <Descriptions.Item label="OIDC Enabled">{compliance?.oidc_enabled ? "✓" : "✗"}</Descriptions.Item>
              <Descriptions.Item label="OIDC Status">{compliance?.oidc_ok ? "OK" : "Error"}</Descriptions.Item>
              <Descriptions.Item label="Outbox Dead">{compliance?.outbox_dead || 0}</Descriptions.Item>
              <Descriptions.Item label="Outbox Failed">{compliance?.outbox_failed || 0}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="System Information">
            <Descriptions column={{ xs: 1, md: 2 }}>
              <Descriptions.Item label="System Name">{systemAbout?.system_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="Deployment Mode">{systemAbout?.deployment_mode || "-"}</Descriptions.Item>
              <Descriptions.Item label="Auth Mode">{systemAbout?.auth_mode || "-"}</Descriptions.Item>
              <Descriptions.Item label="Database">{systemAbout?.database_engine || "-"}</Descriptions.Item>
              <Descriptions.Item label="Modules" span={2}>
                <Space wrap>
                  {systemAbout?.modules?.map((m) => <Tag key={m}>{m}</Tag>)}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Features" span={2}>
                <Space wrap>
                  {systemAbout?.key_features?.map((f) => <Tag key={f} color="blue">{f}</Tag>)}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Integrations" span={2}>
                <Space wrap>
                  {Object.entries(systemAbout?.integrations || {}).map(([k, v]) => (
                    <Tag key={k} color={v ? "green" : "default"}>{k}: {v ? "✓" : "✗"}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Roles Supported" span={2}>
                <Space wrap>
                  {systemAbout?.roles_supported?.map((r) => <Tag key={r}>{r}</Tag>)}
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </>
      )}
    </div>
  );
}

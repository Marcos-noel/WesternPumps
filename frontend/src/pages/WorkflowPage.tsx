import { useEffect, useState } from "react";
import { App as AntdApp, Card, Button, Space, Descriptions, Spin, Modal, Form, Input, Select, Divider } from "antd";
import { ReloadOutlined, SaveOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { workflowApi, type WorkflowRules } from "../api/workflow";

export default function WorkflowPage() {
  const { message } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<WorkflowRules | null>(null);
  const [jsonEditor, setJsonEditor] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [evaluateModalVisible, setEvaluateModalVisible] = useState(false);
  const [evaluateResult, setEvaluateResult] = useState<{ matched: boolean; next_state: string | null } | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await workflowApi.getRules();
      setRules(data);
      setJsonEditor(JSON.stringify(data.rules, null, 2));
    } catch (error) {
      message.error("Failed to load workflow rules");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRules = async () => {
    setJsonError(null);
    try {
      const parsedRules = JSON.parse(jsonEditor);
      setSaving(true);
      await workflowApi.updateRules(parsedRules);
      message.success("Workflow rules saved successfully");
      loadRules();
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        setJsonError("Invalid JSON: " + error.message);
      } else {
        message.error("Failed to save workflow rules");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEvaluate = async () => {
    try {
      const values = await form.validateFields();
      const result = await workflowApi.evaluate(values.entity, values.event, values.current_state);
      setEvaluateResult(result);
    } catch (error) {
      message.error("Failed to evaluate workflow");
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Workflow Rules</h1>
        <Space>
          <Button icon={<PlayCircleOutlined />} onClick={() => setEvaluateModalVisible(true)}>
            Evaluate Transition
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadRules} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveRules} loading={saving}>
            Save Rules
          </Button>
        </Space>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 50 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Card>
          <p style={{ marginBottom: 16, color: "#666" }}>
            Configure workflow state transition rules. The rules define how entities (like jobs, requests) transition between states based on events.
          </p>
          
          {jsonError && (
            <div style={{ color: "#ff4d4f", marginBottom: 16, padding: 8, background: "#fff2f0", borderRadius: 4 }}>
              {jsonError}
            </div>
          )}

          <Input.TextArea
            value={jsonEditor}
            onChange={(e) => setJsonEditor(e.target.value)}
            style={{ fontFamily: "monospace", minHeight: 400 }}
            placeholder="Enter workflow rules as JSON..."
          />

          <Divider />

          <Descriptions title="Current Rules" column={1}>
            {rules?.rules && Object.entries(rules.rules).map(([entity, entityRules]) => (
              <Descriptions.Item key={entity} label={entity}>
                <pre style={{ margin: 0, fontSize: 12, background: "#f5f5f5", padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(entityRules, null, 2)}
                </pre>
              </Descriptions.Item>
            ))}
          </Descriptions>
        </Card>
      )}

      <Modal
        title="Evaluate Workflow Transition"
        open={evaluateModalVisible}
        onCancel={() => {
          setEvaluateModalVisible(false);
          setEvaluateResult(null);
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleEvaluate}>
          <Form.Item name="entity" label="Entity" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "job", label: "Job" },
                { value: "request", label: "Request" },
              ]}
            />
          </Form.Item>
          <Form.Item name="event" label="Event" rules={[{ required: true }]}>
            <Input placeholder="e.g., part_issued, approved" />
          </Form.Item>
          <Form.Item name="current_state" label="Current State" rules={[{ required: true }]}>
            <Input placeholder="e.g., open, pending" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Evaluate
            </Button>
          </Form.Item>
        </Form>
        
        {evaluateResult && (
          <div style={{ marginTop: 16, padding: 16, background: evaluateResult.matched ? "#f6ffed" : "#fff2f0", borderRadius: 4 }}>
            <strong>Result:</strong> {evaluateResult.matched ? "Transition Allowed" : "No Matching Rule"}
            {evaluateResult.next_state && <div>Next State: <strong>{evaluateResult.next_state}</strong></div>}
          </div>
        )}
      </Modal>
    </div>
  );
}

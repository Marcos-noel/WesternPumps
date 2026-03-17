import React, { useState, useEffect } from "react";
import { Input, Button, Card, Spin, Empty, Tag, Divider, Alert, Space } from "antd";
import { SendOutlined } from "@ant-design/icons";
import { api } from "../api/client";

interface AIResponse {
  answer: string;
  data_sources: string[];
  confidence: number;
  suggested_actions: string[];
}

interface SystemContext {
  database_schema: Record<string, any>;
  feature_inventory: Record<string, any>;
  sample_data_counts: Record<string, number>;
  user_role: string;
  available_endpoints: string[];
}

export default function AIAssistantPage() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [systemContext, setSystemContext] = useState<SystemContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemContext();
  }, []);

  const fetchSystemContext = async () => {
    try {
      setContextLoading(true);
      const res = await api.get("/api/ai/system-context");
      setSystemContext(res.data);
      setError(null);
    } catch (err: any) {
      setError(`Failed to load system context: ${err.message}`);
    } finally {
      setContextLoading(false);
    }
  };

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const res = await api.post("/api/ai/query", { query });
      setResponse(res.data);
    } catch (err: any) {
      setError(`Query failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}>
      <h1>🤖 Inventory AI Assistant</h1>
      <p>Ask questions about your inventory system, new features, and database data.</p>

      {contextLoading ? (
        <Spin tip="Loading system context..." />
      ) : (
        <>
          {error && (
            <Alert message="Error" description={error} type="error" style={{ marginBottom: "20px" }} showIcon />
          )}

          <Card style={{ marginBottom: "20px" }}>
            <h3>System Status</h3>
            {systemContext && (
              <div>
                <p><strong>Role:</strong> {systemContext.user_role}</p>
                <p><strong>Database Tables:</strong></p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
                  {Object.entries(systemContext.sample_data_counts).map(([table, count]) => (
                    <div key={table}>
                      <Tag color="blue">{table}: {count} records</Tag>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card style={{ marginBottom: "20px" }}>
            <form onSubmit={handleQuery}>
              <div style={{ display: "flex", gap: "10px" }}>
                <Input
                  placeholder="Ask about ABC analysis, forecasts, pick waves, RMA, costs, etc..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onPressEnter={handleQuery}
                  disabled={loading}
                />
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                  icon={<SendOutlined />}
                >
                  Ask
                </Button>
              </div>
            </form>

            <div style={{ marginTop: "15px" }}>
              <p style={{ fontSize: "12px", color: "#666" }}>
                <strong>Example questions:</strong>
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {[
                  "Show ABC analysis",
                  "What are demand forecasts?",
                  "How do pick waves work?",
                  "Explain RMA process",
                  "How is FIFO cost calculated?",
                  "Inventory overview",
                ].map((example) => (
                  <Button
                    key={example}
                    size="small"
                    onClick={() => {
                      setQuery(example);
                      setTimeout(() => {
                        const form = document.querySelector("form");
                        if (form) form.dispatchEvent(new Event("submit", { bubbles: true }));
                      }, 0);
                    }}
                  >
                    {example}
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          {response && (
            <Card>
              <h3>Assistant Response</h3>
              
              <Alert 
                message={response.answer} 
                type="info" 
                style={{ marginBottom: "20px", whiteSpace: "pre-wrap" }}
              />

              <div style={{ marginBottom: "15px" }}>
                <strong>Confidence:</strong>
                <div style={{ marginTop: "5px" }}>
                  <Tag color={response.confidence > 0.8 ? "green" : "orange"}>
                    {(response.confidence * 100).toFixed(0)}%
                  </Tag>
                </div>
              </div>

              {response.data_sources.length > 0 && (
                <div style={{ marginBottom: "15px" }}>
                  <strong>Data Sources:</strong>
                  <div style={{ marginTop: "5px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {response.data_sources.map((source) => (
                      <Tag key={source} color="cyan">{source}</Tag>
                    ))}
                  </div>
                </div>
              )}

              {response.suggested_actions.length > 0 && (
                <div>
                  <Divider />
                  <strong>Next Steps:</strong>
                  <ul style={{ marginTop: "10px" }}>
                    {response.suggested_actions.map((action, idx) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {!response && !loading && systemContext && (
            <Empty description="Ask a question to get started" />
          )}
        </>
      )}
    </div>
  );
}

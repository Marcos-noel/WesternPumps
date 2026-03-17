import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, App as AntdApp, Button, Card, Form, Input, Space, Tag, Typography } from "antd";
import { ArrowUpOutlined, PlusOutlined, RobotOutlined, SyncOutlined } from "@ant-design/icons";
import { analyzeAssistantRemote, getAssistantSystemContext } from "../api/assistant";
import { analyzeAssistant, type AssistantMemory, type AssistantSkillMode } from "../ai/assistantEngine";
import { buildAssistantContext, type AssistantScanData } from "../ai/contextBuilder";
import { useAuth } from "../state/AuthContext";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  mode: AssistantSkillMode;
  at: string;
  confidence?: number | null;
  evidence?: string[];
  memory?: AssistantMemory;
  action?: {
    name: string;
    success: boolean;
    message: string;
  } | null;
};

function canViewFinance(role: string): boolean {
  const r = (role || "technician").toLowerCase();
  return r === "admin" || r === "manager" || r === "finance";
}

const BASE_STARTER_PROMPTS = [
  "Scan everything in the system",
  "Who are the technicians?",
  "What requests are pending?",
  "Show urgent jobs",
  "Give me low-stock priorities",
];

export default function AssistantPage() {
  const { message } = AntdApp.useApp();
  const { user } = useAuth();
  const role = (user?.role || "technician").toLowerCase();
  const financeAllowed = canViewFinance(role);
  const roleLabel = role.replace(/_/g, " ");
  const operatorName = user?.full_name?.trim() || user?.email || "operator";
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantFollowUps, setAssistantFollowUps] = useState<string[]>([]);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantActionState, setAssistantActionState] = useState<{
    executing: boolean;
    name?: string;
    success?: boolean;
    message?: string;
  } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: `Welcome to WesternPumps operations, ${operatorName}. I am synced to your ${roleLabel} workspace.`,
      mode: "auto",
      at: new Date().toISOString()
    }
  ]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatBodyRef = useRef<HTMLDivElement | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  const [summary, setSummary] = useState({
    lowStockCount: 0,
    pendingRequests: 0,
    openJobs: 0,
    inventoryValue: 0
  });
  const [scanData, setScanData] = useState<AssistantScanData>({
    items: [],
    requests: [],
    jobs: [],
    suppliers: [],
    customers: [],
    users: [],
    transactions: []
  });

  const assistantContext = useMemo(() => buildAssistantContext(role, summary, scanData), [role, summary, scanData]);
  const starterPrompts = useMemo(() => {
    const rolePrompts = [...BASE_STARTER_PROMPTS];
    if (role === "rider" || role === "driver") {
      return ["Show active delivery requests", "What deliveries are pending assignment?", "What should I deliver first?"];
    }
    if (role === "technician" || role === "lead_technician" || role === "staff") {
      rolePrompts.unshift("What requests should I submit now?");
    }
    if (financeAllowed) rolePrompts.push("Finance snapshot for today");
    return rolePrompts;
  }, [financeAllowed, role]);
  const quickPrompts = assistantFollowUps.length > 0 ? assistantFollowUps.slice(0, 8) : starterPrompts;
  const hasConversation = chatMessages.some((m) => m.role === "user");
  const renderedMessages = hasConversation ? chatMessages : [];

  useEffect(() => {
    if (!chatEndRef.current || !stickToBottom) return;
    chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, assistantLoading, stickToBottom]);

  async function refreshContext() {
    setLoading(true);
    setError(null);
    try {
      const context = await getAssistantSystemContext("auto");
      const summaryData = context.summary || {};
      const samples = context.samples || {};
      setSummary({
        lowStockCount: Number(summaryData.low_stock || 0),
        pendingRequests: Number(summaryData.pending_requests || 0),
        openJobs: Number(summaryData.open_jobs || 0),
        inventoryValue: Number(summaryData.inventory_value || 0)
      });
      setScanData({
        items:
          (samples.low_stock as any[] | undefined)?.map((p: any) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            qoh: p.qoh,
            min: p.min,
            updated_at: p.updated_at || ""
          })) || [],
        requests: (samples.requests as any[] | undefined)?.map((r: any) => ({ id: r.id, status: r.status, created_at: r.created_at })) || [],
        jobs: (samples.jobs as any[] | undefined)?.map((j: any) => ({ id: j.id, title: j.title, status: j.status, priority: j.priority })) || [],
        suppliers: [],
        customers: [],
        users: (samples.users as any[] | undefined)?.map((u: any) => ({ id: u.id, email: u.email, role: u.role })) || [],
        transactions:
          (samples.transactions as any[] | undefined)?.map((t: any) => ({
            id: t.id,
            part_id: t.part_id,
            transaction_type: t.transaction_type,
            quantity_delta: t.quantity_delta,
            created_at: t.created_at
          })) || []
      });
    } catch (e: any) {
      setError(e?.message || "Failed to load assistant context");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshContext();
  }, []);

  async function runAssistant(questionOverride?: string) {
    const question = (questionOverride ?? assistantQuestion).trim();
    if (!question) return;
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: question,
      mode: "auto",
      at: new Date().toISOString()
    };
    const historyWithCurrent = [...chatMessages, userMessage].map((m) => ({
      role: m.role,
      text: m.text,
      mode: m.mode,
      memory: m.memory
    }));
    setChatMessages((prev) => [...prev, userMessage]);
    setAssistantQuestion("");
    setAssistantLoading(true);
    setAssistantActionState(null);
    try {
      const remote = await analyzeAssistantRemote({
        question,
        mode: "auto",
        role,
        summary,
        scan: scanData,
        history: historyWithCurrent
      }).catch(() => null);

      if (remote?.answer) {
        const remoteFollowUps = (remote.followUps ?? []).filter((item) => financeAllowed || !item.toLowerCase().includes("finance"));
        setAssistantFollowUps(remoteFollowUps);
        const action = remote.toolResult
          ? {
              name: remote.toolResult.name,
              success: remote.toolResult.success,
              message: remote.toolResult.message
            }
          : null;
        if (action) {
          setAssistantActionState({
            executing: false,
            name: action.name,
            success: action.success,
            message: action.message
          });
        }
        setChatMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            role: "assistant",
            text: remote.answer,
            mode: remote.modeUsed ?? "auto",
            at: new Date().toISOString(),
            confidence: remote.confidence ?? 0.9,
            evidence: remote.evidence ?? [],
            memory: remote.memory,
            action
          }
        ]);
        if (action) {
          message[action.success ? "success" : "warning"](
            `${action.success ? "AI action executed" : "AI action blocked"}: ${action.message}`
          );
          await refreshContext();
        }
        return;
      }

      const local = analyzeAssistant(question, "auto", assistantContext, historyWithCurrent);
      setAssistantFollowUps(local.followUps.filter((item) => financeAllowed || !item.toLowerCase().includes("finance")));
      setChatMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: "assistant",
          text: local.answer,
          mode: local.modeUsed,
            at: new Date().toISOString(),
            confidence: local.confidence,
            evidence: local.evidence,
            memory: local.memory,
            action: null
          }
        ]);
    } finally {
      setAssistantLoading(false);
    }
  }

  return (
    <div className="container page-shell assistant-v3-page">
      <div className="page-topbar">
        <div className="page-heading">
          <Typography.Title level={2} style={{ marginTop: 0 }}>AI Assistant</Typography.Title>
          <Typography.Text type="secondary" className="page-subtitle">
            Conversational agent for live system intelligence, actions, and operational guidance.
          </Typography.Text>
        </div>
        <Space className="page-quick-actions">
          <Button icon={<SyncOutlined />} onClick={refreshContext} loading={loading} type="primary">Refresh Context</Button>
          <Button
            onClick={() =>
              setChatMessages([
                {
                  id: `reset-${Date.now()}`,
                  role: "assistant",
                  text: `New WesternPumps chat ready for ${roleLabel}. Ask for live operational analysis by request ref, job, SKU, or team member.`,
                  mode: "auto",
                  at: new Date().toISOString(),
                  memory: { topic: "auto" }
                }
              ])
            }
          >
            New Chat
          </Button>
        </Space>
      </div>

      {error ? <Alert type="error" message={error} showIcon /> : null}

      <div className="assistant-v3-shell">
        <Card className="assistant-v3-sidebar console-glass-card" bordered={false}>
          <div className="assistant-v3-sidebar-head">
            <Typography.Text strong>Workspace</Typography.Text>
          </div>
          <div className="assistant-v3-suggestions">
            {quickPrompts.map((prompt) => (
              <button key={prompt} className="assistant-v3-suggestion" onClick={() => runAssistant(prompt)} type="button">
                {prompt}
              </button>
            ))}
          </div>
          <div className="assistant-kpi-strip">
            <Tag bordered={false}>Low Stock {summary.lowStockCount}</Tag>
            <Tag bordered={false}>Pending {summary.pendingRequests}</Tag>
            <Tag bordered={false}>Open Jobs {summary.openJobs}</Tag>
          </div>
        </Card>

        <Card className="assistant-v3-main console-glass-card" bordered={false} title={<Space><RobotOutlined />Operations Agent</Space>}>
          <div className="assistant-main-shell">
            {assistantActionState?.message ? (
              <Alert
                type={assistantActionState.success ? "success" : "warning"}
                showIcon
                message={assistantActionState.message}
                style={{ marginBottom: 12 }}
              />
            ) : null}
            <div
              className="assistant-chat-body assistant-chat-body-premium"
              ref={chatBodyRef}
              onScroll={(e) => {
                const target = e.currentTarget;
                const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
                setStickToBottom(distanceFromBottom < 24);
              }}
            >
              {!hasConversation ? (
                <div className="assistant-v3-empty">
                  <Typography.Title level={2} style={{ marginBottom: 8 }}>Where should we begin?</Typography.Title>
                  <Typography.Text type="secondary">{`${timeGreeting}, how are you today? How can I assist you in WesternPumps?`}</Typography.Text>
                </div>
              ) : null}

              {renderedMessages.map((msg) => (
                <div key={msg.id} className={`assistant-message assistant-message-${msg.role}`}>
                  <div className="assistant-message-meta">
                    <span>{msg.role === "assistant" ? "Agent" : "You"}</span>
                    <span>{new Date(msg.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="assistant-message-bubble">{msg.text}</div>
                  {msg.action ? (
                    <div className={`assistant-action-pill ${msg.action.success ? "success" : "warning"}`}>
                      {msg.action.success ? "Action executed" : "Action blocked"}: {msg.action.name}
                    </div>
                  ) : null}
                </div>
              ))}
              {assistantLoading ? (
                <div className="assistant-message assistant-message-assistant">
                  <div className="assistant-message-meta">
                    <span>Agent</span>
                    <span>thinking...</span>
                  </div>
                  <div className="assistant-message-bubble assistant-message-loading">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ) : null}
              <div ref={chatEndRef} />
            </div>

            <Form className="assistant-composer" layout="vertical" onFinish={() => runAssistant()}>
              <div className="assistant-v3-inputbar">
                <button
                  className="assistant-v3-plus"
                  type="button"
                  onClick={() => message.info("Attachments and action tools are being prepared for WesternPumps workflows.")}
                  aria-label="Add tools"
                >
                  <PlusOutlined />
                </button>
                <Input.TextArea
                  value={assistantQuestion}
                  onChange={(e) => setAssistantQuestion(e.target.value)}
                  autoSize={{ minRows: 1, maxRows: 5 }}
                  placeholder="Ask WesternPumps AI anything"
                  className="assistant-v3-input"
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      void runAssistant();
                    }
                  }}
                />
                <button
                  className="assistant-v3-send"
                  type="submit"
                  disabled={assistantLoading || assistantQuestion.trim().length === 0}
                  aria-label="Send message"
                >
                  <ArrowUpOutlined />
                </button>
              </div>
            </Form>
          </div>
        </Card>
      </div>
    </div>
  );
}

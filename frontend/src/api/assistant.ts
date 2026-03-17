import { api } from "./client";
import type { AssistantMemory, AssistantSkillMode } from "../ai/assistantEngine";
import type { AssistantSummary, AssistantScanData } from "../ai/contextBuilder";

export type AssistantAnalyzeTurn = {
  role: "user" | "assistant";
  text: string;
  mode: AssistantSkillMode;
  memory?: AssistantMemory;
};

export type AssistantAnalyzePayload = {
  question: string;
  mode: AssistantSkillMode;
  role: string;
  summary: AssistantSummary;
  scan: AssistantScanData;
  history?: AssistantAnalyzeTurn[];
};

export type AssistantAnalyzeResponse = {
  answer: string;
  modeUsed?: AssistantSkillMode;
  confidence?: number;
  evidence?: string[];
  followUps?: string[];
  memory?: AssistantMemory;
  toolCall?: {
    name: string;
    arguments: Record<string, unknown>;
  } | null;
  toolResult?: {
    name: string;
    success: boolean;
    message: string;
    data?: Record<string, unknown>;
    executed_at: string;
  } | null;
};

export type AssistantSystemContext = {
  actor: Record<string, unknown>;
  role: string;
  permissions: Record<string, unknown>;
  summary: Record<string, unknown>;
  recentActivity: Array<Record<string, unknown>>;
  salesMetrics: Record<string, unknown>;
  intelligence: Record<string, unknown>;
  samples: Record<string, unknown>;
};

export async function analyzeAssistantRemote(payload: AssistantAnalyzePayload): Promise<AssistantAnalyzeResponse | null> {
  if (import.meta.env.VITE_ASSISTANT_REMOTE === "false") {
    return null;
  }
  return (
    await api.post<AssistantAnalyzeResponse>("/api/assistant/analyze", {
      question: payload.question,
      mode: payload.mode,
      history: payload.history ?? []
    })
  ).data;
}

export async function getAssistantSystemContext(mode: AssistantSkillMode = "auto"): Promise<AssistantSystemContext> {
  return (await api.get<AssistantSystemContext>("/api/assistant/context", { params: { mode } })).data;
}

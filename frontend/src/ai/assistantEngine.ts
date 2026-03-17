import { formatKes } from "../utils/currency";
import { formatRequestRef } from "../utils/requestRef";
import type { AssistantContext } from "./contextBuilder";

export type AssistantSkillMode = "auto" | "people" | "requests" | "jobs" | "stock" | "finance";

export type AssistantMemory = {
  topic?: AssistantSkillMode;
  requestId?: number;
  jobId?: number;
  sku?: string;
};

export type AssistantHistoryTurn = {
  role: "user" | "assistant";
  text: string;
  mode: AssistantSkillMode;
  memory?: AssistantMemory;
};

export type AssistantResult = {
  answer: string;
  modeUsed: AssistantSkillMode;
  confidence: number;
  evidence: string[];
  followUps: string[];
  memory?: AssistantMemory;
};

export const ASSISTANT_SKILL_OPTIONS: Array<{ label: string; value: AssistantSkillMode }> = [
  { label: "Auto", value: "auto" },
  { label: "People", value: "people" },
  { label: "Requests", value: "requests" },
  { label: "Jobs", value: "jobs" },
  { label: "Stock", value: "stock" },
  { label: "Finance", value: "finance" }
];

type NlpEntities = {
  requestId?: number;
  jobId?: number;
  sku?: string;
  email?: string;
  status?: string;
};

function suggest(mode: AssistantSkillMode): string[] {
  if (mode === "people") return ["Who are the technicians?", "List managers", "How many users by role?"];
  if (mode === "requests") return ["REQ-5 status", "Who approved that request?", "Can I issue it now?"];
  if (mode === "jobs") return ["Open jobs by priority", "Job 12 status", "Which jobs are urgent?"];
  if (mode === "stock") return ["Low stock summary", "SKU M2 status", "What needs replenishment first?"];
  if (mode === "finance") return ["Inventory value snapshot", "Latest stock movement", "What should finance export daily?"];
  return ["Scan everything in the system", "What should I prioritize today?", "Show me key risks"];
}

function canViewFinance(role: string): boolean {
  const r = (role || "technician").toLowerCase();
  return r === "admin" || r === "manager" || r === "finance";
}

function modeFromQuestion(question: string): AssistantSkillMode {
  const q = normalizeText(question);
  const score = {
    people: 0,
    requests: 0,
    jobs: 0,
    stock: 0,
    finance: 0
  };
  const add = (mode: keyof typeof score, points: number) => {
    score[mode] += points;
  };
  if (/(technician|manager|users?|people|team|accounts?|who\s+is|who\s+are)/.test(q)) add("people", 2);
  if (/(req[-\s#]*\d+|request|approve|approval|pending|reject|issued|closed)/.test(q)) add("requests", 2);
  if (/(job[-\s#]*\d+|jobs?|priority|field|assigned|dispatch)/.test(q)) add("jobs", 2);
  if (/(sku|stock|replen|inventory|low stock|movement|transaction|qoh|min qty)/.test(q)) add("stock", 2);
  if (/(finance|value|cost|reconcile|audit|report|transparency|valuation)/.test(q)) add("finance", 2);

  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] <= 0) return "auto";
  return best[0] as AssistantSkillMode;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[_.,;:!?()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEntities(question: string): NlpEntities {
  const q = normalizeText(question);
  const requestMatch = q.match(/req[-\s#]*(\d+)/i);
  const jobMatch = q.match(/job[-\s#]*(\d+)/i);
  const skuMatch = q.match(/\b[a-z]{1,5}-?[a-z0-9]{2,}\b/i);
  const emailMatch = q.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  const statusMatch = q.match(/\b(pending|approved|rejected|issued|closed|open|completed|canceled)\b/i);
  return {
    requestId: requestMatch ? Number(requestMatch[1]) : undefined,
    jobId: jobMatch ? Number(jobMatch[1]) : undefined,
    sku: skuMatch?.[0],
    email: emailMatch?.[0],
    status: statusMatch?.[0]?.toLowerCase()
  };
}

function isFollowUpQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return /(that|it|same|again|the one|this one|what about|and status|can i approve|can i issue)/i.test(q);
}

function isGreeting(question: string): boolean {
  const q = question.toLowerCase().trim();
  return /^(hi|hey|hello|yo|good morning|good afternoon|good evening|how are you)\b/.test(q);
}

function isThanks(question: string): boolean {
  const q = question.toLowerCase().trim();
  return /^(thanks|thank you|nice|great|cool)\b/.test(q);
}

function memoryFromEvidence(mode: AssistantSkillMode, evidence: string[]): AssistantMemory {
  const mem: AssistantMemory = { topic: mode === "auto" ? undefined : mode };
  const requestEvidence = evidence.find((e) => e.startsWith("request:"));
  if (requestEvidence) mem.requestId = Number(requestEvidence.split(":")[1]);
  const jobEvidence = evidence.find((e) => e.startsWith("job:"));
  if (jobEvidence) mem.jobId = Number(jobEvidence.split(":")[1]);
  const skuEvidence = evidence.find((e) => e.startsWith("sku:"));
  if (skuEvidence) mem.sku = skuEvidence.split(":")[1];
  return mem;
}

function augmentWithHistory(question: string, history: AssistantHistoryTurn[]): { q: string; modeHint: AssistantSkillMode } {
  const trimmed = question.trim();
  if (!trimmed || !isFollowUpQuestion(trimmed)) return { q: trimmed, modeHint: "auto" };

  const last = [...history].reverse().find((t) => t.role === "assistant" && t.memory);
  if (!last?.memory) return { q: trimmed, modeHint: "auto" };

  if (last.memory.requestId && !/req[-\s#]*\d+/i.test(trimmed)) {
    return { q: `${trimmed} for REQ-${last.memory.requestId}`, modeHint: "requests" };
  }
  if (last.memory.jobId && !/job[-\s#]*\d+/i.test(trimmed)) {
    return { q: `${trimmed} for job ${last.memory.jobId}`, modeHint: "jobs" };
  }
  if (last.memory.sku && !/\b[a-z]{1,5}-?[a-z0-9]{2,}\b/i.test(trimmed)) {
    return { q: `${trimmed} for SKU ${last.memory.sku}`, modeHint: "stock" };
  }
  if (last.memory.topic) {
    return { q: trimmed, modeHint: last.memory.topic };
  }
  return { q: trimmed, modeHint: "auto" };
}

export function analyzeAssistant(
  question: string,
  selectedMode: AssistantSkillMode,
  context: AssistantContext,
  history: AssistantHistoryTurn[] = []
): AssistantResult {
  const withHistory = augmentWithHistory(question, history);
  const q = normalizeText(withHistory.q);
  const mode = selectedMode === "auto" ? (withHistory.modeHint === "auto" ? modeFromQuestion(q) : withHistory.modeHint) : selectedMode;
  const entities = extractEntities(q);
  const financeAllowed = canViewFinance(context.role);
  const baseline = `Low stock ${context.summary.lowStockCount}, pending requests ${context.summary.pendingRequests}, open jobs ${context.summary.openJobs}, inventory value ${formatKes(context.summary.inventoryValue)}.`;
  const evidenceBase = [
    `items:${context.scan.items.length}`,
    `requests:${context.scan.requests.length}`,
    `jobs:${context.scan.jobs.length}`,
    `users:${context.scan.users.length}`,
    `tx:${context.scan.transactions.length}`
  ];

  if (isGreeting(q)) {
    return {
      answer: "Hello. I am ready to help. Ask about requests, jobs, stock, people, or finance, and I will use your current system data.",
      modeUsed: "auto",
      confidence: 0.99,
      evidence: [],
      followUps: suggest("auto"),
      memory: { topic: selectedMode === "auto" ? "auto" : selectedMode }
    };
  }

  if (isThanks(q)) {
    return {
      answer: "You are welcome. If you want, I can continue with a fresh system scan or drill into one area.",
      modeUsed: "auto",
      confidence: 0.99,
      evidence: [],
      followUps: suggest("auto"),
      memory: { topic: selectedMode === "auto" ? "auto" : selectedMode }
    };
  }

  if (entities.requestId) {
    const reqId = entities.requestId;
    const req = context.requestById.get(reqId);
    if (req) {
      const evidence = [`request:${req.id}`, ...evidenceBase];
      return {
        answer: `${formatRequestRef(req.id)} is ${String(req.status || "").toUpperCase()} (created ${new Date(req.created_at).toLocaleString()}).`,
        modeUsed: "requests",
        confidence: 0.98,
        evidence,
        followUps: suggest("requests"),
        memory: memoryFromEvidence("requests", evidence)
      };
    }
    return {
      answer: `${formatRequestRef(reqId)} was not found in your accessible request scope.`,
      modeUsed: "requests",
      confidence: 0.88,
      evidence: evidenceBase,
      followUps: suggest("requests"),
      memory: { topic: "requests", requestId: reqId }
    };
  }

  if (entities.jobId) {
    const jobId = entities.jobId;
    const job = context.jobById.get(jobId);
    if (job) {
      const evidence = [`job:${job.id}`, ...evidenceBase];
      return {
        answer: `Job #${job.id} (${job.title}) is ${String(job.status || "").toUpperCase()} with ${String(job.priority || "").toUpperCase()} priority.`,
        modeUsed: "jobs",
        confidence: 0.98,
        evidence,
        followUps: suggest("jobs"),
        memory: memoryFromEvidence("jobs", evidence)
      };
    }
    return {
      answer: `Job #${jobId} was not found in your accessible job scope.`,
      modeUsed: "jobs",
      confidence: 0.88,
      evidence: evidenceBase,
      followUps: suggest("jobs"),
      memory: { topic: "jobs", jobId }
    };
  }

  if (entities.sku) {
    const item = context.itemBySku.get(entities.sku.toLowerCase());
    if (item) {
      const risk = item.qoh <= item.min ? "LOW STOCK" : "OK";
      const evidence = [`sku:${item.sku}`, ...evidenceBase];
      return {
        answer: `${item.sku} (${item.name}) has on-hand ${item.qoh}, minimum ${item.min}, status ${risk}, last updated ${new Date(item.updated_at).toLocaleString()}.`,
        modeUsed: "stock",
        confidence: 0.97,
        evidence,
        followUps: suggest("stock"),
        memory: memoryFromEvidence("stock", evidence)
      };
    }
  }

  if (!q || q.includes("scan") || q.includes("everything") || q.includes("overview") || q.includes("system")) {
    const modules = [
      `items ${context.scan.items.length}`,
      `requests ${context.scan.requests.length}`,
      `jobs ${context.scan.jobs.length}`,
      `suppliers ${context.scan.suppliers.length}`,
      `customers ${context.scan.customers.length}`,
      `users ${context.scan.users.length}`,
      `transactions ${context.scan.transactions.length}`
    ].join(", ");
    return {
      answer: `System scan complete: ${modules}. ${baseline}`,
      modeUsed: selectedMode === "auto" ? "auto" : selectedMode,
      confidence: 0.9,
      evidence: evidenceBase,
      followUps: suggest(selectedMode === "auto" ? "auto" : selectedMode),
      memory: { topic: selectedMode === "auto" ? modeFromQuestion(q) : selectedMode }
    };
  }

  if (/(key risks|main risks|top risks|risks?|what is risky|what's risky|critical issues)/i.test(q)) {
    const risks: string[] = [];
    if (context.summary.lowStockCount > 0) {
      risks.push(`Low-stock exposure: ${context.summary.lowStockCount} item(s) below minimum.`);
    }
    if (context.summary.pendingRequests > 0) {
      risks.push(`Workflow bottleneck: ${context.summary.pendingRequests} request(s) pending/approved and not fully cleared.`);
    }
    if (context.summary.openJobs > 0) {
      risks.push(`Operational pressure: ${context.summary.openJobs} open job(s) likely to consume stock soon.`);
    }
    if (risks.length === 0) {
      risks.push("No immediate critical risks detected in your visible scope.");
    }
    const topActions = [
      context.summary.pendingRequests > 0 ? "Clear approval/issue queue first." : null,
      context.summary.lowStockCount > 0 ? "Replenish top low-stock SKUs next." : null,
      context.summary.openJobs > 0 ? "Align issued stock to active jobs and verify returns." : null
    ].filter(Boolean);
    return {
      answer: `Key risks now: ${risks.join(" ")} ${topActions.length > 0 ? `Recommended sequence: ${topActions.join(" ")}` : ""}`.trim(),
      modeUsed: "auto",
      confidence: 0.93,
      evidence: [
        `low_stock:${context.summary.lowStockCount}`,
        `pending_requests:${context.summary.pendingRequests}`,
        `open_jobs:${context.summary.openJobs}`,
        ...evidenceBase
      ],
      followUps: ["Show top low-stock SKUs", "Show pending request refs", "Show urgent jobs"],
      memory: { topic: "auto" }
    };
  }

  if (mode === "people") {
    if (entities.email) {
      const matchedUser = context.scan.users.find((u) => (u.email || "").toLowerCase() === entities.email?.toLowerCase());
      if (matchedUser) {
        return {
          answer: `${matchedUser.email} is a ${matchedUser.role} account in your visible scope.`,
          modeUsed: "people",
          confidence: 0.95,
          evidence: [`user:${matchedUser.id}`, `role:${matchedUser.role}`],
          followUps: suggest("people"),
          memory: { topic: "people" }
        };
      }
    }
    const technicians = context.scan.users.filter((u) => ["technician", "lead_technician", "staff"].includes((u.role || "").toLowerCase()));
    const managers = context.scan.users.filter((u) => ["manager", "store_manager", "admin"].includes((u.role || "").toLowerCase()));
    const financeUsers = context.scan.users.filter((u) => (u.role || "").toLowerCase() === "finance");
    const grouped = `Technicians ${technicians.length}, Managers ${managers.length}, Finance ${financeUsers.length}.`;
    const sample = context.scan.users.slice(0, 8).map((u) => `${u.email} (${u.role})`).join(", ");
    return {
      answer: `${grouped} Visible sample: ${sample || "no users visible in current scope"}.`,
      modeUsed: "people",
      confidence: 0.92,
      evidence: [`users:${context.scan.users.length}`, `role:${context.role}`],
      followUps: suggest("people"),
      memory: { topic: "people" }
    };
  }

  if (mode === "requests") {
    const visible = entities.status
      ? context.scan.requests.filter((r) => String(r.status || "").toLowerCase() === entities.status)
      : context.scan.requests;
    const pending = context.scan.requests.filter((r) => ["pending", "approved"].includes((r.status || "").toLowerCase())).length;
    const newest = visible.slice(0, 5).map((r) => `${formatRequestRef(r.id)}:${String(r.status || "").toUpperCase()}`).join(", ");
    return {
      answer: `Requests in scope: ${context.scan.requests.length}. Workflow queue (pending/approved): ${pending}. ${entities.status ? `${entities.status.toUpperCase()} requests visible: ${visible.length}. ` : ""}Recent: ${newest || "none"}.`,
      modeUsed: "requests",
      confidence: 0.93,
      evidence: [`requests:${context.scan.requests.length}`, `pending:${pending}`, entities.status ? `status:${entities.status}` : ""].filter(Boolean),
      followUps: suggest("requests"),
      memory: { topic: "requests" }
    };
  }

  if (mode === "jobs") {
    const filtered = entities.status
      ? context.scan.jobs.filter((j) => String(j.status || "").toLowerCase() === entities.status)
      : context.scan.jobs;
    const open = filtered.filter((j) => !["completed", "canceled"].includes((j.status || "").toLowerCase()));
    const urgent = open.filter((j) => (j.priority || "").toLowerCase() === "urgent");
    return {
      answer: `${entities.status ? `${entities.status.toUpperCase()} jobs: ${filtered.length}. ` : ""}Open jobs: ${open.length}. Urgent jobs: ${urgent.length}. Focus: issue required items before technician dispatch and confirm returns after closure.`,
      modeUsed: "jobs",
      confidence: 0.91,
      evidence: [`jobs:${context.scan.jobs.length}`, `open:${open.length}`, `urgent:${urgent.length}`, entities.status ? `status:${entities.status}` : ""].filter(Boolean),
      followUps: suggest("jobs"),
      memory: { topic: "jobs" }
    };
  }

  if (mode === "stock") {
    const topSku = context.topLowStockSku ? `Top low-stock SKU: ${context.topLowStockSku}.` : "";
    const latestTx = context.scan.transactions[0];
    const latestTxText = latestTx
      ? ` Latest movement: #${latestTx.id} ${latestTx.transaction_type} ${latestTx.quantity_delta} at ${new Date(latestTx.created_at).toLocaleString()}.`
      : "";
    return {
      answer: `Low-stock items: ${context.summary.lowStockCount}. ${topSku} ${baseline}${latestTxText}`.trim(),
      modeUsed: "stock",
      confidence: 0.94,
      evidence: [`low_stock:${context.summary.lowStockCount}`, ...evidenceBase],
      followUps: suggest("stock"),
      memory: { topic: "stock", sku: context.topLowStockSku ?? undefined }
    };
  }

  if (mode === "finance") {
    if (!financeAllowed) {
      return {
        answer: "This workspace supports requests, jobs, and stock insights. Ask me for any of those and I will drill in.",
        modeUsed: "auto",
        confidence: 0.99,
        evidence: ["guard:finance_restricted"],
        followUps: suggest("auto").filter((item) => !item.toLowerCase().includes("finance")),
        memory: { topic: "auto" }
      };
    }
    return {
      answer: `Finance snapshot: ${baseline} Recommended pack: Stock Level, Stock Movement, Audit Trail. Reconcile movement deltas against valuation daily.`,
      modeUsed: "finance",
      confidence: 0.95,
      evidence: [`inventory_value:${context.summary.inventoryValue}`, `transactions:${context.scan.transactions.length}`],
      followUps: suggest("finance"),
      memory: { topic: "finance" }
    };
  }

  return {
    answer: `Current system pulse: ${baseline} If you want deeper analysis, ask for key risks, top low-stock SKUs, pending request refs, or urgent jobs.`,
    modeUsed: "auto",
    confidence: 0.84,
    evidence: evidenceBase,
    followUps: suggest("auto").filter((item) => financeAllowed || !item.toLowerCase().includes("finance")),
    memory: { topic: "auto" }
  };
}

export type AssistantSummary = {
  lowStockCount: number;
  pendingRequests: number;
  openJobs: number;
  inventoryValue: number;
};

export type AssistantScanData = {
  items: Array<{ id: number; sku: string; name: string; qoh: number; min: number; updated_at: string }>;
  requests: Array<{ id: number; status: string; created_at: string }>;
  jobs: Array<{ id: number; title: string; status: string; priority: string }>;
  suppliers: Array<{ id: number; name: string }>;
  customers: Array<{ id: number; name: string }>;
  users: Array<{ id: number; email: string; role: string }>;
  transactions: Array<{ id: number; part_id: number; transaction_type: string; quantity_delta: number; created_at: string }>;
};

export type AssistantContext = {
  role: string;
  summary: AssistantSummary;
  scan: AssistantScanData;
  topLowStockSku: string | null;
  requestById: Map<number, AssistantScanData["requests"][number]>;
  jobById: Map<number, AssistantScanData["jobs"][number]>;
  itemBySku: Map<string, AssistantScanData["items"][number]>;
};

export function buildAssistantContext(role: string, summary: AssistantSummary, scan: AssistantScanData): AssistantContext {
  const requestById = new Map<number, AssistantScanData["requests"][number]>();
  const jobById = new Map<number, AssistantScanData["jobs"][number]>();
  const itemBySku = new Map<string, AssistantScanData["items"][number]>();

  scan.requests.forEach((r) => requestById.set(r.id, r));
  scan.jobs.forEach((j) => jobById.set(j.id, j));
  scan.items.forEach((item) => itemBySku.set(item.sku.toLowerCase(), item));

  return {
    role: role.toLowerCase(),
    summary,
    scan,
    topLowStockSku: scan.items.find((item) => item.qoh <= item.min)?.sku ?? null,
    requestById,
    jobById,
    itemBySku
  };
}

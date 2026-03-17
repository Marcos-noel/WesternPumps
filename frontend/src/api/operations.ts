import { api } from "./client";
import type {
  CycleCount,
  ExecutiveSummary,
  GoodsReceipt,
  KpiSummary,
  PurchaseOrderDispatchResult,
  PurchaseOrder,
  ReplenishmentSuggestion,
  Reservation,
  StockTransfer,
} from "./types";

type PurchaseOrderCreatePayload = {
  supplier_id: number;
  expected_date?: string | null;
  notes?: string;
  lines: Array<{ part_id: number; ordered_quantity: number; unit_cost?: number | null }>;
};

type GoodsReceiptCreatePayload = {
  grn_number: string;
  notes: string;
  lines: Array<{
    purchase_order_line_id: number;
    received_quantity: number;
    accepted_quantity: number;
    rejected_quantity: number;
    variance_reason?: string | null;
    lot_code?: string | null;
    expiry_date?: string | null;
  }>;
};

export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  return (await api.get("/api/operations/purchase-orders")).data;
}

export async function createPurchaseOrder(payload: PurchaseOrderCreatePayload): Promise<PurchaseOrder> {
  return (await api.post("/api/operations/purchase-orders", payload)).data;
}

export async function updatePurchaseOrderStatus(poId: number, status: string, notes?: string): Promise<PurchaseOrder> {
  return (await api.post(`/api/operations/purchase-orders/${poId}/status`, { status, notes })).data;
}

export async function dispatchPurchaseOrder(
  poId: number,
  payload: { recipient_email?: string; message?: string }
): Promise<PurchaseOrderDispatchResult> {
  return (await api.post(`/api/operations/purchase-orders/${poId}/dispatch`, payload)).data;
}

export async function receivePurchaseOrder(poId: number, payload: GoodsReceiptCreatePayload): Promise<GoodsReceipt> {
  return (await api.post(`/api/operations/purchase-orders/${poId}/receipts`, payload)).data;
}

export async function createReservation(payload: {
  part_id: number;
  quantity: number;
  request_id?: number | null;
  notes?: string;
}): Promise<Reservation> {
  return (await api.post("/api/operations/reservations", payload)).data;
}

export async function releaseReservation(reservationId: number): Promise<Reservation> {
  return (await api.post(`/api/operations/reservations/${reservationId}/release`)).data;
}

export async function listTransfers(): Promise<StockTransfer[]> {
  return (await api.get("/api/operations/transfers")).data;
}

export async function createTransfer(payload: {
  from_location_id: number;
  to_location_id: number;
  notes?: string;
  lines: Array<{ part_id: number; quantity: number }>;
}): Promise<StockTransfer> {
  return (await api.post("/api/operations/transfers", payload)).data;
}

export async function approveTransfer(transferId: number): Promise<StockTransfer> {
  return (await api.post(`/api/operations/transfers/${transferId}/approve`)).data;
}

export async function completeTransfer(transferId: number): Promise<StockTransfer> {
  return (await api.post(`/api/operations/transfers/${transferId}/complete`)).data;
}

export async function listCycleCounts(): Promise<CycleCount[]> {
  return (await api.get("/api/operations/cycle-counts")).data;
}

export async function createCycleCount(payload: { location_id: number; notes?: string }): Promise<CycleCount> {
  return (await api.post("/api/operations/cycle-counts", payload)).data;
}

export async function submitCycleCount(
  cycleId: number,
  lines: Array<{ id: number; counted_quantity: number; reason?: string }>
): Promise<CycleCount> {
  return (await api.post(`/api/operations/cycle-counts/${cycleId}/submit`, { lines })).data;
}

export async function approveCycleCount(cycleId: number, notes: string): Promise<CycleCount> {
  return (await api.post(`/api/operations/cycle-counts/${cycleId}/approve`, { notes })).data;
}

export async function rejectCycleCount(cycleId: number, notes: string): Promise<CycleCount> {
  return (await api.post(`/api/operations/cycle-counts/${cycleId}/reject`, { notes })).data;
}

export async function getReplenishmentSuggestions(lookbackDays = 30): Promise<ReplenishmentSuggestion[]> {
  return (await api.get("/api/operations/replenishment/suggestions", { params: { lookback_days: lookbackDays } })).data;
}

export async function getKpiSummary(lookbackDays = 90): Promise<KpiSummary> {
  return (await api.get("/api/operations/kpi/summary", { params: { lookback_days: lookbackDays } })).data;
}

export async function getExecutiveSummary(days = 7): Promise<ExecutiveSummary> {
  return (await api.get("/api/operations/executive/summary", { params: { days } })).data;
}

import { api } from "../api/client";
import { listItems, listLowStock } from "../api/items";
import { listRequests } from "../api/requests";
import { createStockTransaction } from "../api/stock";
import { listSuppliers as fetchSuppliersLegacy } from "../api/suppliers";
import type { DashboardSummary, Product, ReceivingPayload, Supplier, TrendPoint } from "./types";

type Paginated<T> = { items: T[]; total: number };

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  try {
    const [itemsResp, lowResp] = await Promise.all([
      listItems({ page: 1, page_size: 1000, sort: "updated_at", direction: "desc", include_inactive: true }),
      listLowStock({ limit: 1000 })
    ]);
    let openOrders = 0;
    try {
      const reqs = await listRequests();
      openOrders = reqs.filter((r) => ["PENDING", "APPROVED"].includes((r.status || "").toUpperCase())).length;
    } catch {
      const reqs = await listRequests({ mine: true });
      openOrders = reqs.filter((r) => ["PENDING", "APPROVED"].includes((r.status || "").toUpperCase())).length;
    }

    const inventoryValue = itemsResp.items.reduce((acc, item) => acc + (item.unit_price ?? 0) * (item.quantity_on_hand ?? 0), 0);
    return {
      totalSkus: itemsResp.total,
      inventoryValue,
      lowStockCount: lowResp.length,
      openOrders
    };
  } catch {
    return { totalSkus: 0, inventoryValue: 0, lowStockCount: 0, openOrders: 0 };
  }
}

export async function fetchStockTrend(days = 30): Promise<TrendPoint[]> {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const points: TrendPoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(end);
    d.setDate(end.getDate() - (days - 1 - i));
    const day = d.toISOString().slice(0, 10);
    const seasonal = Math.max(0, Math.round(8 + Math.sin(i / 3) * 4 + (i % 5)));
    const inQty = Math.max(0, Math.round(10 + Math.cos(i / 4) * 5));
    points.push({
      date: day,
      in: inQty,
      out: seasonal,
      forecast: Math.max(0, Math.round(seasonal * 1.08))
    });
  }
  return points;
}

export async function fetchProducts(params: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}): Promise<Paginated<Product>> {
  const resp = await listItems({
    page: params.page,
    page_size: params.pageSize,
    q: params.search,
    sort: (params.sortBy as any) || "updated_at",
    direction: params.sortDir || "desc",
    include_inactive: true
  });
  let mapped: Product[] = resp.items.map((item) => {
    const onHand = Number(item.quantity_on_hand ?? 0);
    const minLevel = Number(item.min_quantity ?? 0);
    const status = onHand <= 0 ? "out_of_stock" : onHand <= minLevel ? "low_stock" : "in_stock";
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      category: undefined,
      supplierName: undefined,
      onHand,
      minLevel,
      unitPrice: Number(item.unit_price ?? 0),
      status,
      updatedAt: item.updated_at
    };
  });
  if (params.status) mapped = mapped.filter((p) => p.status === params.status);
  return { items: mapped, total: params.status ? mapped.length : resp.total };
}

export async function fetchSuppliers(): Promise<Supplier[]> {
  try {
    const rows = await fetchSuppliersLegacy({ include_inactive: true });
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      contactName: s.contact_name ?? undefined,
      email: s.email ?? undefined,
      phone: s.phone ?? undefined,
      active: Boolean(s.is_active),
      leadTimeDays: undefined
    }));
  } catch {
    return [];
  }
}

export async function receiveOrder(payload: ReceivingPayload): Promise<{ id: string; message: string }> {
  for (const line of payload.lines) {
    await createStockTransaction({
      part_id: line.productId,
      transaction_type: "IN",
      quantity_delta: Math.max(1, Math.round(line.quantity)),
      notes: `PO ${payload.poNumber} received`,
      supplier_id: payload.supplierId || null
    });
  }
  return { id: crypto.randomUUID(), message: "Receiving posted to stock transactions" };
}

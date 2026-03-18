import { api } from "./client";
import type { Supplier } from "./types";

export interface SupplierReport {
  supplier_id: number;
  supplier_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  total_parts_supplied: number;
  total_transactions: number;
  total_stock_in_value: number;
  avg_lead_time_days: number | null;
  recent_transactions: {
    id: number;
    part_name: string;
    part_sku: string;
    quantity: number;
    value: number;
    date: string;
  }[];
}

export async function listSuppliers(params?: { q?: string; include_inactive?: boolean }): Promise<Supplier[]> {
  return (
    await api.get<Supplier[]>("/api/suppliers", {
      params
    })
  ).data;
}

export async function createSupplier(payload: {
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active?: boolean;
}): Promise<Supplier> {
  return (await api.post<Supplier>("/api/suppliers", payload)).data;
}

export async function updateSupplier(
  supplierId: number,
  payload: {
    name?: string;
    contact_name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    notes?: string | null;
    is_active?: boolean;
  }
): Promise<Supplier> {
  return (await api.patch<Supplier>(`/api/suppliers/${supplierId}`, payload)).data;
}

export async function deactivateSupplier(supplierId: number): Promise<void> {
  await api.delete(`/api/suppliers/${supplierId}`);
}

export async function getSupplierReport(
  supplierId: number,
  startDate?: string,
  endDate?: string
): Promise<SupplierReport> {
  const params = new URLSearchParams();
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);
  return (await api.get<SupplierReport>(`/api/suppliers/${supplierId}/report?${params}`)).data;
}


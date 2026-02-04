import { api } from "./client";
import type { Supplier } from "./types";

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


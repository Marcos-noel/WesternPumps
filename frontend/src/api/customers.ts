import { api } from "./client";
import type { Customer } from "./types";

export async function listCustomers(): Promise<Customer[]> {
  return (await api.get<Customer[]>("/customers")).data;
}

export async function createCustomer(payload: {
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}): Promise<Customer> {
  return (await api.post<Customer>("/customers", payload)).data;
}


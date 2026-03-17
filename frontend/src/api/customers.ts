import { api } from "./client";
import type { Customer } from "./types";

export async function listCustomers(): Promise<Customer[]> {
  return (await api.get<Customer[]>("/customers")).data;
}

export type CustomerPayload = {
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
};

export async function createCustomer(payload: CustomerPayload): Promise<Customer> {
  return (await api.post<Customer>("/customers", payload)).data;
}

export async function updateCustomer(customerId: number, payload: Partial<CustomerPayload>): Promise<Customer> {
  return (await api.patch<Customer>(`/customers/${customerId}`, payload)).data;
}

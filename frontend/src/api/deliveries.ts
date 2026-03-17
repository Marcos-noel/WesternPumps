import { api } from "./client";
import type { DeliveryRequest } from "./types";

export type CreateDeliveryRequestPayload = {
  stock_request_id?: number | null;
  technician_id?: number | null;
  delivery_mode: "RIDER" | "DRIVER";
  pickup_location?: string | null;
  dropoff_location?: string | null;
  equipment_summary: string;
  notes?: string | null;
};

export async function listDeliveryRequests(params?: { mine?: boolean; status?: string }): Promise<DeliveryRequest[]> {
  return (await api.get<DeliveryRequest[]>("/api/deliveries", { params })).data;
}

export async function createDeliveryRequest(payload: CreateDeliveryRequestPayload): Promise<DeliveryRequest> {
  return (await api.post<DeliveryRequest>("/api/deliveries", payload)).data;
}

export async function assignDeliveryRequest(deliveryId: number, assigneeUserId: number): Promise<DeliveryRequest> {
  return (await api.post<DeliveryRequest>(`/api/deliveries/${deliveryId}/assign`, { assignee_user_id: assigneeUserId })).data;
}

export async function claimDeliveryRequest(deliveryId: number): Promise<DeliveryRequest> {
  return (await api.post<DeliveryRequest>(`/api/deliveries/${deliveryId}/claim`)).data;
}

export async function approveDeliveryRequest(deliveryId: number): Promise<DeliveryRequest> {
  return (await api.post<DeliveryRequest>(`/api/deliveries/${deliveryId}/approve`)).data;
}

export async function rejectDeliveryRequest(deliveryId: number, reason: string): Promise<DeliveryRequest> {
  return (await api.post<DeliveryRequest>(`/api/deliveries/${deliveryId}/reject`, { reason })).data;
}

export async function pickupDeliveryRequest(deliveryId: number): Promise<DeliveryRequest> {
  return (await api.post<DeliveryRequest>(`/api/deliveries/${deliveryId}/pickup`)).data;
}

export async function deliverDeliveryRequest(deliveryId: number): Promise<DeliveryRequest> {
  return (await api.post<DeliveryRequest>(`/api/deliveries/${deliveryId}/deliver`)).data;
}

export async function cancelDeliveryRequest(deliveryId: number, reason: string): Promise<DeliveryRequest> {
  return (await api.post<DeliveryRequest>(`/api/deliveries/${deliveryId}/cancel`, { reason })).data;
}

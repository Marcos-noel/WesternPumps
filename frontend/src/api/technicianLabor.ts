import { api } from "./client";

export type TechnicianLabor = {
  id: number;
  tenant_id: number;
  technician_id: number;
  job_id?: number | null;
  date: string;
  labor_hours: number;
  labor_rate: number;
  labor_cost: number;
  fuel_cost: number;
  fare_cost: number;
  other_expenses: number;
  total_cost: number;
  description?: string | null;
  status: string;
  approved_by_user_id?: number | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  technician_name?: string;
  job_title?: string;
};

export type TechnicianLaborCreate = {
  technician_id: number;
  job_id?: number | null;
  date: string;
  labor_hours: number;
  labor_rate: number;
  fuel_cost: number;
  fare_cost: number;
  other_expenses?: number;
  description?: string | null;
};

export type TechnicianLaborUpdate = Partial<TechnicianLaborCreate>;

export async function listTechnicianLabor(params?: {
  technician_id?: number;
  job_id?: number;
  date_from?: string;
  date_to?: string;
  status?: string;
}): Promise<TechnicianLabor[]> {
  const searchParams = new URLSearchParams();
  if (params?.technician_id) searchParams.set("technician_id", String(params.technician_id));
  if (params?.job_id) searchParams.set("job_id", String(params.job_id));
  if (params?.date_from) searchParams.set("date_from", params.date_from);
  if (params?.date_to) searchParams.set("date_to", params.date_to);
  if (params?.status) searchParams.set("status", params.status);
  
  const response = await api.get<TechnicianLabor[]>(`/technician-labor?${searchParams}`);
  return response.data;
}

export async function getTechnicianLabor(id: number): Promise<TechnicianLabor> {
  const response = await api.get<TechnicianLabor>(`/technician-labor/${id}`);
  return response.data;
}

export async function createTechnicianLabor(data: TechnicianLaborCreate): Promise<TechnicianLabor> {
  const response = await api.post<TechnicianLabor>("/technician-labor", data);
  return response.data;
}

export async function updateTechnicianLabor(id: number, data: TechnicianLaborUpdate): Promise<TechnicianLabor> {
  const response = await api.patch<TechnicianLabor>(`/technician-labor/${id}`, data);
  return response.data;
}

export async function approveTechnicianLabor(id: number): Promise<TechnicianLabor> {
  const response = await api.post<TechnicianLabor>(`/technician-labor/${id}/approve`);
  return response.data;
}

export async function rejectTechnicianLabor(id: number): Promise<TechnicianLabor> {
  const response = await api.post<TechnicianLabor>(`/technician-labor/${id}/reject`);
  return response.data;
}

export async function exportTechnicianLabor(params?: {
  technician_id?: number;
  date_from?: string;
  date_to?: string;
}): Promise<Blob> {
  const searchParams = new URLSearchParams();
  if (params?.technician_id) searchParams.set("technician_id", String(params.technician_id));
  if (params?.date_from) searchParams.set("date_from", params.date_from);
  if (params?.date_to) searchParams.set("date_to", params.date_to);
  
  const response = await api.get(`/technician-labor/export?${searchParams}`, {
    responseType: "blob",
  });
  return response.data;
}

export async function getTechnicianDailySummary(date: string): Promise<{
  date: string;
  total_technicians: number;
  total_tasks_completed: number;
  total_labor_cost: number;
  total_fuel_cost: number;
  total_fare_cost: number;
  technicians: Array<{
    technician_id: number;
    technician_name: string;
    tasks_completed: number;
    labor_cost: number;
    fuel_cost: number;
    fare_cost: number;
  }>;
}> {
  const response = await api.get(`/technician-labor/daily-summary?date=${date}`);
  return response.data;
}

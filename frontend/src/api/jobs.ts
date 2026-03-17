import { api } from "./client";
import type { Job } from "./types";

export async function listJobs(): Promise<Job[]> {
  return (await api.get<Job[]>("/jobs")).data;
}

export type JobPayload = {
  customer_id: number;
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assigned_to_user_id?: number | null;
  site_location_label?: string | null;
  site_latitude?: number | null;
  site_longitude?: number | null;
};

export async function createJob(payload: JobPayload): Promise<Job> {
  return (await api.post<Job>("/jobs", payload)).data;
}

export async function updateJob(jobId: number, payload: Partial<JobPayload>): Promise<Job> {
  return (await api.patch<Job>(`/jobs/${jobId}`, payload)).data;
}

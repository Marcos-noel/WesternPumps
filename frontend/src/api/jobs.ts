import { api } from "./client";
import type { Job } from "./types";

export async function listJobs(): Promise<Job[]> {
  return (await api.get<Job[]>("/jobs")).data;
}

export async function createJob(payload: {
  customer_id: number;
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
}): Promise<Job> {
  return (await api.post<Job>("/jobs", payload)).data;
}


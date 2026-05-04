import { api } from "./client";
import type { Job } from "./types";

export interface JobPhoto {
  id: number;
  job_id: number;
  file_name: string;
  photo_type: string;
  description: string | null;
  content_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}

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

// Job Photo functions
export async function uploadJobPhoto(
  jobId: number,
  file: File,
  photoType: string = "GENERAL",
  description: string = ""
): Promise<JobPhoto> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("photo_type", photoType);
  if (description) {
    formData.append("description", description);
  }
  return (await api.post<JobPhoto>(`/jobs/${jobId}/photos`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })).data;
}

export async function listJobPhotos(jobId: number): Promise<JobPhoto[]> {
  return (await api.get<JobPhoto[]>(`/jobs/${jobId}/photos`)).data;
}

export async function downloadJobPhoto(jobId: number, photoId: number): Promise<Blob> {
  return (
    await api.get(`/jobs/${jobId}/photos/${photoId}/download`, {
      responseType: "blob",
    })
  ).data;
}

// Job Approval Workflow functions
export async function submitJobForApproval(jobId: number): Promise<Job> {
  return (await api.post<Job>(`/jobs/${jobId}/submit-for-approval`)).data;
}

export async function approveJob(jobId: number, notes: string = ""): Promise<Job> {
  return (await api.post<Job>(`/jobs/${jobId}/approve`, { notes })).data;
}

export async function rejectJob(jobId: number, reason: string): Promise<Job> {
  return (await api.post<Job>(`/jobs/${jobId}/reject`, { reason })).data;
}

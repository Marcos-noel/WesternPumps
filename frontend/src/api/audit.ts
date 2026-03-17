import { api } from "./client";

export interface AuditLogResponse {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  detail: string | null;
  prev_hash: string | null;
  entry_hash: string | null;
  created_at: string;
}

export interface AuditLogListResponse {
  items: AuditLogResponse[];
  total: number;
  page: number;
  page_size: number;
}

export interface HashVerificationResponse {
  is_valid: boolean;
  verified_entries: number;
  total_entries: number;
  first_invalid_hash: string | null;
  details: string | null;
}

export interface AuditFilters {
  page?: number;
  page_size?: number;
  user_id?: number;
  action?: string;
  entity_type?: string;
  entity_id?: number;
  start_date?: string;
  end_date?: string;
}

export const auditApi = {
  list: async (filters: AuditFilters = {}): Promise<AuditLogListResponse> => {
    const params = new URLSearchParams();
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.page_size) params.append("page_size", filters.page_size.toString());
    if (filters.user_id) params.append("user_id", filters.user_id.toString());
    if (filters.action) params.append("action", filters.action);
    if (filters.entity_type) params.append("entity_type", filters.entity_type);
    if (filters.entity_id) params.append("entity_id", filters.entity_id.toString());
    if (filters.start_date) params.append("start_date", filters.start_date);
    if (filters.end_date) params.append("end_date", filters.end_date);
    
    const response = await api.get<AuditLogListResponse>(`/api/audit?${params.toString()}`);
    return response.data;
  },

  verifyHash: async (): Promise<HashVerificationResponse> => {
    const response = await api.get<HashVerificationResponse>("/api/audit/verify-hash");
    return response.data;
  },

  getEntityTrail: async (entityType: string, entityId: number): Promise<AuditLogResponse[]> => {
    const response = await api.get<AuditLogResponse[]>(`/api/audit/entity/${entityType}/${entityId}`);
    return response.data;
  },

  getActions: async (): Promise<string[]> => {
    const response = await api.get<string[]>("/api/audit/actions");
    return response.data;
  },

  getEntityTypes: async (): Promise<string[]> => {
    const response = await api.get<string[]>("/api/audit/entity-types");
    return response.data;
  },
};

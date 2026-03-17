import { api } from "./client";

// Platform Operations Types

export interface OutboxHealth {
  pending: number;
  processing: number;
  failed: number;
  dead: number;
  done_last_24h: number;
}

export interface ComplianceStatus {
  generated_at: string;
  auth_enabled: boolean;
  https_enforced: boolean;
  security_headers_enabled: boolean;
  oidc_enabled: boolean;
  oidc_ok: boolean;
  outbox_dead: number;
  outbox_failed: number;
  status: string;
}

export interface SystemAbout {
  generated_at: string;
  system_name: string;
  deployment_mode: string;
  auth_mode: string;
  database_engine: string;
  roles_supported: string[];
  modules: string[];
  key_features: string[];
  integrations: Record<string, boolean>;
  controls: Record<string, boolean>;
}

// Standalone exports for easier importing
export const getOutboxHealth = async (): Promise<OutboxHealth> => {
  const response = await api.get<OutboxHealth>("/api/platform/outbox/health");
  return response.data;
};

export const getComplianceStatus = async (): Promise<ComplianceStatus> => {
  const response = await api.get<ComplianceStatus>("/api/platform/compliance/status");
  return response.data;
};

export const getSystemAbout = async (): Promise<SystemAbout> => {
  const response = await api.get<SystemAbout>("/api/platform/system/about");
  return response.data;
};

export const retryDeadOutbox = async (limit: number = 100): Promise<{ retried: number; actor_user_id: number }> => {
  const response = await api.post<{ retried: number; actor_user_id: number }>("/api/platform/outbox/retry-dead", null, {
    params: { limit },
  });
  return response.data;
};

export const platformApi = {
  // Outbox Health
  getOutboxHealth: async (): Promise<OutboxHealth> => {
    const response = await api.get<OutboxHealth>("/api/platform/outbox/health");
    return response.data;
  },

  retryDeadLetters: async (limit = 100): Promise<{ retried: number; actor_user_id: number }> => {
    const response = await api.post<{ retried: number; actor_user_id: number }>("/api/platform/outbox/retry-dead", null, {
      params: { limit },
    });
    return response.data;
  },

  // Compliance Status
  getComplianceStatus: async (): Promise<ComplianceStatus> => {
    const response = await api.get<ComplianceStatus>("/api/platform/compliance/status");
    return response.data;
  },

  // System About
  getSystemAbout: async (): Promise<SystemAbout> => {
    const response = await api.get<SystemAbout>("/api/platform/system/about");
    return response.data;
  },
};

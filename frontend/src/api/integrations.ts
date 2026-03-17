import { api } from "./client";

export type ExternalIntegration = {
  api_base: string;
  webhook_url: string;
  enabled: boolean;
};

export type ExternalIntegrationUpdate = {
  api_base: string;
  webhook_url: string;
  webhook_secret: string;
  enabled: boolean;
};

export type IntegrationTestResult = {
  ok: boolean;
  detail: string;
};

export async function getFinanceIntegration(): Promise<ExternalIntegration> {
  return (await api.get<ExternalIntegration>("/api/integrations/finance")).data;
}

export async function updateFinanceIntegration(payload: ExternalIntegrationUpdate): Promise<ExternalIntegration> {
  return (await api.put<ExternalIntegration>("/api/integrations/finance", payload)).data;
}

export async function testFinanceIntegration(): Promise<IntegrationTestResult> {
  return (await api.post<IntegrationTestResult>("/api/integrations/finance/test")).data;
}

export async function getErpIntegration(): Promise<ExternalIntegration> {
  return (await api.get<ExternalIntegration>("/api/integrations/erp")).data;
}

export async function updateErpIntegration(payload: ExternalIntegrationUpdate): Promise<ExternalIntegration> {
  return (await api.put<ExternalIntegration>("/api/integrations/erp", payload)).data;
}

export async function testErpIntegration(): Promise<IntegrationTestResult> {
  return (await api.post<IntegrationTestResult>("/api/integrations/erp/test")).data;
}

export async function getAccountingIntegration(): Promise<ExternalIntegration> {
  return (await api.get<ExternalIntegration>("/api/integrations/accounting")).data;
}

export async function updateAccountingIntegration(payload: ExternalIntegrationUpdate): Promise<ExternalIntegration> {
  return (await api.put<ExternalIntegration>("/api/integrations/accounting", payload)).data;
}

export async function testAccountingIntegration(): Promise<IntegrationTestResult> {
  return (await api.post<IntegrationTestResult>("/api/integrations/accounting/test")).data;
}


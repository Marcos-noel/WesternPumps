import { api } from "./client";
import axios from "axios";

export type AppSettings = {
  approval_threshold_manager: number;
  approval_threshold_admin: number;
  approval_individual_role: "none" | "manager" | "admin";
  low_stock_default_limit: number;
  notification_email_enabled: boolean;
  notification_sms_enabled: boolean;
  notification_recipients: string;
  faulty_quarantine_location_id: number | null;
  branding_logo_url: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_from_email: string;
  smtp_use_tls: boolean;
};

export async function getAppSettings(): Promise<AppSettings> {
  return (await api.get<AppSettings>("/api/admin/settings")).data;
}

export async function updateAppSettings(payload: Partial<AppSettings>): Promise<AppSettings> {
  return (await api.put<AppSettings>("/api/admin/settings", payload)).data;
}

export async function testEmailSettings(payload: { recipient?: string; subject?: string }): Promise<{ ok: boolean; detail: string; recipient: string }> {
  return (await api.post<{ ok: boolean; detail: string; recipient: string }>("/api/admin/settings/test-email", payload)).data;
}

export async function getBrandingSettings(): Promise<{ branding_logo_url: string }> {
  const unavailableKey = "branding_endpoint_unavailable_until";
  const now = Date.now();
  const unavailableUntil = Number(localStorage.getItem(unavailableKey) || "0");
  if (unavailableUntil > now) {
    return { branding_logo_url: "" };
  }
  try {
    const result = (await api.get<{ branding_logo_url: string }>("/api/admin/settings/branding")).data;
    localStorage.removeItem(unavailableKey);
    return result;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      localStorage.setItem(unavailableKey, String(now + 60 * 1000));
      return { branding_logo_url: "" };
    }
    throw err;
  }
}

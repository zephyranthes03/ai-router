/**
 * HTTP client for the local FastAPI server.
 * Handles: analyze, health, settings.
 */

import type {
  AnalyzeResponse,
  HealthStatus,
  UserSettings,
  UserSettingsUpdate,
  UsageRecord,
} from "../types";
import { LOCAL_API_URL } from "./env";

export async function analyze(
  message: string,
  tier?: string,
  speedQualityWeight?: number,
): Promise<AnalyzeResponse> {
  const payload: Record<string, unknown> = { message };
  if (tier) payload.tier = tier;
  if (speedQualityWeight !== undefined)
    payload.speed_quality_weight = speedQualityWeight;

  const resp = await fetch(`${LOCAL_API_URL}/analyze/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`Analyze failed: ${resp.status}`);
  return resp.json();
}

export async function getHealth(): Promise<HealthStatus> {
  const resp = await fetch(`${LOCAL_API_URL}/health/`);
  if (!resp.ok) throw new Error(`Health check failed: ${resp.status}`);
  return resp.json();
}

export async function getSettings(): Promise<UserSettings> {
  const resp = await fetch(`${LOCAL_API_URL}/settings/`);
  if (!resp.ok) throw new Error(`Get settings failed: ${resp.status}`);
  return resp.json();
}

export async function updateSettings(
  update: UserSettingsUpdate
): Promise<UserSettings> {
  const resp = await fetch(`${LOCAL_API_URL}/settings/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!resp.ok) throw new Error(`Update settings failed: ${resp.status}`);
  return resp.json();
}

export async function logUsage(record: UsageRecord): Promise<void> {
  try {
    await fetch(`${LOCAL_API_URL}/usage/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
  } catch {
    // Fire and forget — do not break chat flow
  }
}

export async function getUsageHistory(params?: {
  start_ts?: number;
  end_ts?: number;
  provider_id?: string;
  limit?: number;
}): Promise<{ records: UsageRecord[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.start_ts) searchParams.set("start_ts", String(params.start_ts));
  if (params?.end_ts) searchParams.set("end_ts", String(params.end_ts));
  if (params?.provider_id) searchParams.set("provider_id", params.provider_id);
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const resp = await fetch(`${LOCAL_API_URL}/usage/history?${searchParams}`);
  if (!resp.ok) throw new Error(`Get usage history failed: ${resp.status}`);
  return resp.json();
}

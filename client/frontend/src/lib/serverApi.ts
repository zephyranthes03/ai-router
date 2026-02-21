/**
 * HTTP client for the remote gateway server.
 * Handles: providers, estimate, route, usage.
 */

import type {
  Provider,
  EstimateResponse,
  RouteResponse,
  RoutingMetadata,
} from "../types";
import { GATEWAY_SERVER_URL } from "./env";

export interface ServerUsageRecord {
  providerId: string;
  cost: number;
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
  txHash: string | null;
}

export interface ServerUsageResponse {
  records: ServerUsageRecord[];
  stats: {
    count: number;
    totalCost: number;
    totalTokens: number;
  };
}

export async function getServerUsage(): Promise<ServerUsageResponse> {
  const resp = await fetch(`${GATEWAY_SERVER_URL}/usage`);
  if (!resp.ok) throw new Error(`Failed to fetch usage records: ${resp.status}`);
  return resp.json();
}

export async function getProviders(): Promise<Provider[]> {
  const resp = await fetch(`${GATEWAY_SERVER_URL}/providers`);
  if (!resp.ok) throw new Error(`Get providers failed: ${resp.status}`);
  const data = await resp.json();
  return data.providers;
}

export async function estimate(
  providerId: string,
  tokenEstimate: number
): Promise<EstimateResponse> {
  const resp = await fetch(`${GATEWAY_SERVER_URL}/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider_id: providerId,
      token_estimate: tokenEstimate,
    }),
  });
  if (!resp.ok) throw new Error(`Estimate failed: ${resp.status}`);
  return resp.json();
}

export async function route(
  metadata: RoutingMetadata
): Promise<RouteResponse> {
  const resp = await fetch(`${GATEWAY_SERVER_URL}/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ routing_metadata: metadata }),
  });
  if (!resp.ok) throw new Error(`Route failed: ${resp.status}`);
  return resp.json();
}

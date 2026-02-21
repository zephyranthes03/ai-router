/**
 * Frontend runtime configuration.
 * Values are sourced from Vite env vars with local-dev defaults.
 */

function normalizeUrl(value: string | undefined, fallback: string): string {
  const url = (value ?? fallback).trim();
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export const GATEWAY_SERVER_URL = normalizeUrl(
  import.meta.env.VITE_GATEWAY_SERVER_URL,
  "http://localhost:3001"
);

export const LOCAL_API_URL = normalizeUrl(
  import.meta.env.VITE_LOCAL_API_URL,
  "http://localhost:8000"
);

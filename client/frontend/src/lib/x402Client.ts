/**
 * x402-fetch wrapper for paid AI requests via USDC micropayments.
 */

import type { WalletClient } from "viem";
import { wrapFetchWithPayment } from "x402-fetch";
import type { AIResponse, X402RequestParams } from "../types";
import { GATEWAY_SERVER_URL } from "./env";

export async function makeX402Request(
  params: X402RequestParams,
  walletClient: WalletClient
): Promise<AIResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentFetch = wrapFetchWithPayment(fetch, walletClient as any);

  const url = `${GATEWAY_SERVER_URL}/request/${params.provider_id}`;

  const resp = await paymentFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: params.messages,
      options: params.options,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`x402 request failed (${resp.status}): ${text}`);
  }

  return resp.json() as Promise<AIResponse>;
}

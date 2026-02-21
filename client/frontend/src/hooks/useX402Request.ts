/**
 * React hook for making x402 paid AI requests.
 *
 * Supports both injected (wagmi) and embedded wallet modes.
 * Checks embedded wallet first; falls back to wagmi's walletClient.
 */

import { useMutation } from "@tanstack/react-query";
import { useWalletClient } from "wagmi";
import { makeX402Request } from "../lib/x402Client";
import { hasInjectedWallet } from "../lib/embeddedWallet";
import { useEmbeddedWallet } from "../contexts/EmbeddedWalletContext";
import type { AIResponse, X402RequestParams } from "../types";

export function useX402Request() {
  const { data: wagmiWalletClient } = useWalletClient();
  const { walletClient: embeddedWalletClient, state: embeddedState } =
    useEmbeddedWallet();

  return useMutation<AIResponse, Error, X402RequestParams>({
    mutationFn: async (params) => {
      // Pick the right walletClient based on environment
      let client = embeddedWalletClient;

      if (hasInjectedWallet() && wagmiWalletClient) {
        client = wagmiWalletClient;
      }

      if (!client) {
        if (embeddedState !== "unlocked") {
          throw new Error("Wallet is locked. Please unlock it first.");
        }
        throw new Error("Wallet not connected");
      }

      return makeX402Request(params, client);
    },
  });
}

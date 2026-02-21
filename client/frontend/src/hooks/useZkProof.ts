/**
 * React hook for ZK proof generation and on-chain submission.
 * Integrates with the server's usage collector, USDC transfer history
 * (for x402 tx binding), and the ProofRegistry contract.
 * Supports both injected and embedded wallet clients.
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWalletClient, usePublicClient, useAccount } from "wagmi";
import {
  getUsageRecords,
  generateProof,
  submitProofOnChain,
  type ProofGenerateResponse,
  type OnChainProofRecord,
} from "../lib/zkProof";
import {
  PROOF_REGISTRY_ADDRESS,
  IS_PROOF_REGISTRY_CONFIGURED,
  PROOF_REGISTRY_ABI,
} from "../lib/contracts";
import { useUsdcTransfers } from "./useUsdcTransfers";
import { useEmbeddedWallet } from "../contexts/EmbeddedWalletContext";
import { hasInjectedWallet } from "../lib/embeddedWallet";

export type ProofStatus = "idle" | "generating" | "generated" | "submitting" | "submitted" | "error";

export function useZkProof() {
  const { address: injectedAddress } = useAccount();
  const { data: wagmiWalletClient } = useWalletClient();
  const { walletClient: embeddedWalletClient, address: embeddedAddress } = useEmbeddedWallet();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const address = injectedAddress ?? embeddedAddress;
  const walletClient =
    hasInjectedWallet() && wagmiWalletClient ? wagmiWalletClient : embeddedWalletClient;

  const [status, setStatus] = useState<ProofStatus>("idle");
  const [lastProof, setLastProof] = useState<ProofGenerateResponse | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch USDC transfers for x402 tx binding
  const { data: usdcTransfers } = useUsdcTransfers();

  // Fetch current usage records from server
  const usageQuery = useQuery({
    queryKey: ["zk-usage-records"],
    queryFn: getUsageRecords,
    refetchInterval: 10_000,
  });

  // Fetch on-chain proof history for connected user
  const proofHistoryQuery = useQuery({
    queryKey: ["zk-proof-history", address],
    queryFn: async (): Promise<OnChainProofRecord[]> => {
      if (!address || !publicClient) return [];
      if (!IS_PROOF_REGISTRY_CONFIGURED) return [];

      try {
        const proofIds = (await publicClient.readContract({
          address: PROOF_REGISTRY_ADDRESS,
          abi: PROOF_REGISTRY_ABI,
          functionName: "getUserProofs",
          args: [address],
        })) as `0x${string}`[];

        const records: OnChainProofRecord[] = [];
        for (const proofId of proofIds) {
          const proof = (await publicClient.readContract({
            address: PROOF_REGISTRY_ADDRESS,
            abi: PROOF_REGISTRY_ABI,
            functionName: "getProof",
            args: [proofId],
          })) as any;

          records.push({
            proofId,
            prover: proof.prover,
            requestCount: proof.requestCount,
            budgetLimit: proof.budgetLimit,
            timestamp: proof.timestamp,
            commitmentHash: proof.commitmentHash,
            txHashesRoot: proof.txHashesRoot,
          });
        }

        return records.sort((a, b) => Number(b.timestamp - a.timestamp));
      } catch {
        return [];
      }
    },
    enabled: !!address && !!publicClient && IS_PROOF_REGISTRY_CONFIGURED,
    staleTime: 30_000,
  });

  // Generate proof mutation — txHashes are collected server-side from x402 settlements
  const generateMutation = useMutation({
    mutationFn: async (budgetLimit: number) => {
      setStatus("generating");
      setError(null);
      return generateProof(budgetLimit);
    },
    onSuccess: (data) => {
      setLastProof(data);
      setStatus("generated");
      queryClient.invalidateQueries({ queryKey: ["zk-usage-records"] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setStatus("error");
    },
  });

  // Submit proof on-chain mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!lastProof || !walletClient) {
        throw new Error("No proof to submit or wallet not connected");
      }
      setStatus("submitting");
      setError(null);
      return submitProofOnChain(lastProof.calldata, walletClient);
    },
    onSuccess: (txHash) => {
      setLastTxHash(txHash);
      setStatus("submitted");
      setLastProof(null);
      queryClient.invalidateQueries({ queryKey: ["zk-proof-history"] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setStatus("error");
    },
  });

  const reset = useCallback(() => {
    setStatus("idle");
    setLastProof(null);
    setLastTxHash(null);
    setError(null);
  }, []);

  return {
    // State
    status,
    error,
    lastProof,
    lastTxHash,

    // Data
    usageRecords: usageQuery.data,
    isLoadingRecords: usageQuery.isLoading,
    proofHistory: proofHistoryQuery.data ?? [],
    isLoadingHistory: proofHistoryQuery.isLoading,
    usdcTransferCount: usdcTransfers?.length ?? 0,

    // Actions
    generateProof: generateMutation.mutate,
    isGenerating: generateMutation.isPending,
    submitOnChain: submitMutation.mutate,
    isSubmitting: submitMutation.isPending,
    reset,
  };
}

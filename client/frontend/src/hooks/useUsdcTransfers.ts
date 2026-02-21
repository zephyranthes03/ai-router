/**
 * Hook to query USDC Transfer events from Base Sepolia for the active wallet
 * (injected or embedded). Timestamps are estimated from block numbers (~2s/block).
 */

import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import { formatUnits } from "viem";
import { USDC_ADDRESS, ERC20_TRANSFER_EVENT, USDC_DECIMALS } from "../lib/contracts";
import type { UsdcTransfer } from "../types";
import { useEmbeddedWallet } from "../contexts/EmbeddedWalletContext";

export function useUsdcTransfers() {
  const { address: injectedAddress } = useAccount();
  const { address: embeddedAddress } = useEmbeddedWallet();
  const publicClient = usePublicClient();
  const address = injectedAddress ?? embeddedAddress;

  return useQuery<UsdcTransfer[]>({
    queryKey: ["usdc-transfers", address],
    queryFn: async () => {
      if (!address || !publicClient) return [];

      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = currentBlock > 500_000n ? currentBlock - 500_000n : 0n;
      const now = Date.now();

      const logs = await publicClient.getLogs({
        address: USDC_ADDRESS,
        event: ERC20_TRANSFER_EVENT[0],
        args: { from: address },
        fromBlock,
        toBlock: "latest",
      });

      return logs.map((log) => {
        const blockDiff = Number(currentBlock - log.blockNumber);
        const estimatedTimestamp = now - blockDiff * 2000;

        return {
          txHash: log.transactionHash,
          from: (log.args as { from: string }).from,
          to: (log.args as { to: string }).to,
          amount: formatUnits(
            ((log.args as { value: bigint }).value) ?? 0n,
            USDC_DECIMALS
          ),
          estimatedTimestamp,
          blockNumber: log.blockNumber,
        } satisfies UsdcTransfer;
      });
    },
    enabled: !!address && !!publicClient,
    staleTime: 60_000,
  });
}

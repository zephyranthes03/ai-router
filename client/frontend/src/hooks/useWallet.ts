/**
 * Unified wallet hook — works with both injected (MetaMask) and embedded wallet.
 *
 * Priority: if an injected wallet is detected (browser mode), use wagmi.
 * Otherwise fall back to the embedded wallet (desktop app mode).
 */

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useReadContract } from "wagmi";
import { baseSepolia } from "viem/chains";
import { formatUnits } from "viem";

import { USDC_ADDRESS, ERC20_BALANCE_ABI } from "../lib/contracts";
import { hasInjectedWallet } from "../lib/embeddedWallet";
import { useEmbeddedWallet } from "../contexts/EmbeddedWalletContext";
import type { WalletMode } from "../types";

export function useWallet() {
  // ── Injected wallet (wagmi / MetaMask) ──
  const { address: injAddr, isConnected: injConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect: injDisconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const { data: injUsdcRaw, refetch: refetchInjUsdc } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: injAddr ? [injAddr] : undefined,
    chainId: baseSepolia.id,
    query: {
      enabled: !!injAddr,
      refetchInterval: 10_000,
    },
  });

  // ── Embedded wallet ──
  const embedded = useEmbeddedWallet();

  // ── Decide which wallet mode to use ──
  const useInjected = hasInjectedWallet() && injConnected;
  const mode: WalletMode = useInjected ? "injected" : "embedded";

  if (mode === "injected") {
    const isCorrectChain = chain?.id === baseSepolia.id;
    const usdcBalance = injUsdcRaw
      ? formatUnits(injUsdcRaw as bigint, 6)
      : "0";

    return {
      mode: "injected" as const,
      address: injAddr ?? null,
      isConnected: true,
      isCorrectChain,
      usdcBalance,
      connectWallet: () => {
        const connector = connectors[0];
        if (connector) connect({ connector });
      },
      disconnect: injDisconnect,
      switchToBaseSepolia: () => switchChain({ chainId: baseSepolia.id }),
      refetchBalance: () => { refetchInjUsdc(); },
      chain,
      // Embedded wallet fields (inactive)
      embeddedState: embedded.state,
      lockWallet: embedded.lock,
      resetWallet: embedded.resetWallet,
    };
  }

  // Embedded mode
  const isUnlocked = embedded.state === "unlocked";

  return {
    mode: "embedded" as const,
    address: embedded.address,
    isConnected: isUnlocked,
    isCorrectChain: true, // embedded wallet is always on Base Sepolia
    usdcBalance: embedded.usdcBalance,
    connectWallet: () => {
      // In embedded mode, connection is handled by WalletSetup modal
    },
    disconnect: () => embedded.lock(),
    switchToBaseSepolia: () => {
      // No-op: embedded wallet is always Base Sepolia
    },
    refetchBalance: () => { /* embedded wallet balance updates via context */ },
    chain: baseSepolia,
    // Embedded wallet fields
    embeddedState: embedded.state,
    lockWallet: embedded.lock,
    resetWallet: embedded.resetWallet,
  };
}

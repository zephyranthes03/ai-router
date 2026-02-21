/**
 * React context that manages the embedded wallet lifecycle.
 *
 * States:
 *   loading   → checking if keystore exists on disk
 *   no-wallet → first launch, needs setup
 *   locked    → keystore exists, waiting for password
 *   unlocked  → private key decrypted, walletClient ready
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { WalletClient } from "viem";
import type { EmbeddedWalletState, EncryptedKeystore } from "../types";
import {
  loadKeystore,
  deleteKeystore,
  createNewWallet,
  importWallet,
  unlockKeystore,
  createEmbeddedWalletClient,
  getUsdcBalance,
} from "../lib/embeddedWallet";

interface EmbeddedWalletContextValue {
  /** Current wallet state */
  state: EmbeddedWalletState;
  /** Wallet address (available when locked or unlocked) */
  address: `0x${string}` | null;
  /** viem WalletClient for x402 (only when unlocked) */
  walletClient: WalletClient | null;
  /** USDC balance string (refreshed periodically) */
  usdcBalance: string;
  /** Error from the last operation */
  error: string | null;

  /** Generate a new wallet and encrypt with password */
  createWallet: (password: string) => Promise<void>;
  /** Import a private key and encrypt with password */
  importKey: (privateKey: string, password: string) => Promise<void>;
  /** Unlock existing keystore with password */
  unlock: (password: string) => Promise<void>;
  /** Lock the wallet (wipe private key from memory) */
  lock: () => void;
  /** Delete keystore entirely and reset */
  resetWallet: () => Promise<void>;
}

const EmbeddedWalletContext = createContext<EmbeddedWalletContextValue | null>(
  null,
);

export function useEmbeddedWallet() {
  const ctx = useContext(EmbeddedWalletContext);
  if (!ctx)
    throw new Error(
      "useEmbeddedWallet must be used within EmbeddedWalletProvider",
    );
  return ctx;
}

export function EmbeddedWalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EmbeddedWalletState>("loading");
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const keystoreRef = useRef<EncryptedKeystore | null>(null);
  const balanceTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // ── Check keystore on mount ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      const ks = await loadKeystore();
      keystoreRef.current = ks;
      if (ks) {
        setAddress(ks.address as `0x${string}`);
        setState("locked");
      } else {
        setState("no-wallet");
      }
    })();
  }, []);

  // ── USDC balance polling ─────────────────────────────────────────
  useEffect(() => {
    if (!address) return;

    const refresh = () =>
      getUsdcBalance(address).then(setUsdcBalance).catch(() => {});
    refresh();
    balanceTimer.current = setInterval(refresh, 30_000);
    return () => clearInterval(balanceTimer.current);
  }, [address]);

  // ── Actions ──────────────────────────────────────────────────────

  const createWallet = useCallback(async (password: string) => {
    try {
      setError(null);
      const { privateKey, address: addr } = await createNewWallet(password);
      const client = createEmbeddedWalletClient(privateKey);
      setAddress(addr as `0x${string}`);
      setWalletClient(client);
      setState("unlocked");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create wallet");
    }
  }, []);

  const importKey = useCallback(
    async (privateKey: string, password: string) => {
      try {
        setError(null);
        let pk = privateKey.trim();
        if (!pk.startsWith("0x")) pk = "0x" + pk;

        const { address: addr } = await importWallet(
          pk as `0x${string}`,
          password,
        );
        const client = createEmbeddedWalletClient(pk as `0x${string}`);
        setAddress(addr as `0x${string}`);
        setWalletClient(client);
        setState("unlocked");
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Invalid private key or password",
        );
      }
    },
    [],
  );

  const unlock = useCallback(async (password: string) => {
    try {
      setError(null);
      const ks = keystoreRef.current;
      if (!ks) throw new Error("No keystore found");

      const pk = await unlockKeystore(ks, password);
      const client = createEmbeddedWalletClient(pk);
      setWalletClient(client);
      setState("unlocked");
    } catch {
      setError("Wrong password");
    }
  }, []);

  const lock = useCallback(() => {
    setWalletClient(null);
    setState("locked");
  }, []);

  const resetWallet = useCallback(async () => {
    await deleteKeystore();
    keystoreRef.current = null;
    setWalletClient(null);
    setAddress(null);
    setUsdcBalance("0");
    setState("no-wallet");
    setError(null);
  }, []);

  return (
    <EmbeddedWalletContext.Provider
      value={{
        state,
        address,
        walletClient,
        usdcBalance,
        error,
        createWallet,
        importKey,
        unlock,
        lock,
        resetWallet,
      }}
    >
      {children}
    </EmbeddedWalletContext.Provider>
  );
}

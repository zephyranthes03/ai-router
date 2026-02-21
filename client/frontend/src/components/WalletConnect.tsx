/**
 * Wallet status & controls displayed in the app header.
 *
 * - Injected mode (MetaMask in browser): same as before
 * - Embedded mode (desktop app): shows lock/unlock status
 */

import { useConnect } from "wagmi";
import { useWallet } from "../hooks/useWallet";

export default function WalletConnect() {
  const wallet = useWallet();
  const { error: injError, isPending } = useConnect();

  // ── Injected wallet (browser w/ MetaMask) ─────────────────────
  if (wallet.mode === "injected") {
    if (!wallet.isConnected) {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={wallet.connectWallet}
            disabled={isPending}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded font-medium transition-colors"
          >
            {isPending ? "Connecting..." : "Connect Wallet"}
          </button>
          {injError && (
            <span
              className="text-xs text-red-400 max-w-48 truncate"
              title={injError.message}
            >
              {injError.message.includes("provider")
                ? "Install MetaMask"
                : injError.message}
            </span>
          )}
        </div>
      );
    }

    if (!wallet.isCorrectChain) {
      return (
        <button
          onClick={wallet.switchToBaseSepolia}
          className="px-3 py-1.5 text-sm bg-yellow-600 hover:bg-yellow-500 rounded font-medium transition-colors"
        >
          Switch to Base Sepolia
        </button>
      );
    }

    const shortAddr = wallet.address
      ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
      : "";

    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded text-[10px] font-medium uppercase tracking-wide">
          MetaMask
        </span>
        <span className="text-green-400 font-mono">{shortAddr}</span>
        <span className="text-gray-400">
          {parseFloat(wallet.usdcBalance).toFixed(4)} USDC
        </span>
        <button
          onClick={() => wallet.disconnect()}
          className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // ── Embedded wallet (desktop app) ─────────────────────────────

  // Loading / no-wallet / locked states are handled by WalletSetup modal
  if (!wallet.isConnected) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="px-1.5 py-0.5 bg-emerald-900/40 text-emerald-300 rounded text-[10px] font-medium uppercase tracking-wide">
          Embedded
        </span>
        <span className="text-yellow-400 text-xs">
          {wallet.embeddedState === "locked"
            ? "Wallet Locked"
            : "No Wallet"}
        </span>
      </div>
    );
  }

  const shortAddr = wallet.address
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : "";

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="px-1.5 py-0.5 bg-emerald-900/40 text-emerald-300 rounded text-[10px] font-medium uppercase tracking-wide">
        Embedded
      </span>
      <span className="text-green-400 font-mono">{shortAddr}</span>
      <span className="text-gray-400">
        {parseFloat(wallet.usdcBalance).toFixed(4)} USDC
      </span>
      <button
        onClick={wallet.lockWallet}
        className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded transition-colors"
        title="Lock wallet"
      >
        Lock
      </button>
      <button
        onClick={wallet.resetWallet}
        className="px-2 py-1 text-xs text-red-400/60 hover:text-red-300 border border-gray-800 rounded transition-colors"
        title="Delete wallet and start over"
      >
        Reset
      </button>
    </div>
  );
}

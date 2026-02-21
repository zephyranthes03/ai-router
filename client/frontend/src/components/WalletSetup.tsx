/**
 * Modal UI for embedded wallet setup / unlock.
 *
 * - First launch: choose "Generate new wallet" or "Import private key"
 * - Subsequent: enter password to unlock
 */

import { useState } from "react";
import { useEmbeddedWallet } from "../contexts/EmbeddedWalletContext";

export default function WalletSetup() {
  const { state, address, error, createWallet, importKey, unlock } =
    useEmbeddedWallet();

  const [mode, setMode] = useState<"menu" | "create" | "import">("menu");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [privateKeyInput, setPrivateKeyInput] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (state !== "no-wallet" && state !== "locked") return null;

  const handleCreate = async () => {
    if (password.length < 4) {
      setLocalError("Password must be at least 4 characters");
      return;
    }
    if (password !== confirmPw) {
      setLocalError("Passwords do not match");
      return;
    }
    setLoading(true);
    setLocalError(null);
    await createWallet(password);
    setLoading(false);
  };

  const handleImport = async () => {
    if (!privateKeyInput.trim()) {
      setLocalError("Please enter a private key");
      return;
    }
    if (password.length < 4) {
      setLocalError("Password must be at least 4 characters");
      return;
    }
    if (password !== confirmPw) {
      setLocalError("Passwords do not match");
      return;
    }
    setLoading(true);
    setLocalError(null);
    await importKey(privateKeyInput, password);
    setLoading(false);
  };

  const handleUnlock = async () => {
    if (!password) return;
    setLoading(true);
    setLocalError(null);
    await unlock(password);
    setLoading(false);
  };

  const displayError = localError || error;
  const shortAddr = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  // ── Unlock screen ─────────────────────────────────────────────
  if (state === "locked") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-blue-600/20 flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Unlock Wallet</h2>
            <p className="text-sm text-gray-400 mt-1 font-mono">{shortAddr}</p>
          </div>

          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            autoFocus
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 placeholder-gray-500 mb-4"
          />

          {displayError && (
            <p className="text-red-400 text-xs mb-3">{displayError}</p>
          )}

          <button
            onClick={handleUnlock}
            disabled={loading || !password}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? "Unlocking..." : "Unlock"}
          </button>
        </div>
      </div>
    );
  }

  // ── Setup screen (no-wallet) ──────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-emerald-600/20 flex items-center justify-center mx-auto mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Wallet Setup</h2>
          <p className="text-sm text-gray-400 mt-1">
            Set up an embedded wallet for x402 payments
          </p>
        </div>

        {/* Menu */}
        {mode === "menu" && (
          <div className="space-y-3">
            <button
              onClick={() => setMode("create")}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors"
            >
              Generate New Wallet
            </button>
            <button
              onClick={() => setMode("import")}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-sm font-medium transition-colors"
            >
              Import Private Key
            </button>
            <p className="text-xs text-gray-500 text-center mt-4">
              Your private key is encrypted and stored locally.
              <br />
              It never leaves this device.
            </p>
          </div>
        )}

        {/* Create new wallet */}
        {mode === "create" && (
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Set a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-500"
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-500"
            />

            {displayError && (
              <p className="text-red-400 text-xs">{displayError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMode("menu");
                  setPassword("");
                  setConfirmPw("");
                  setLocalError(null);
                }}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-sm font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? "Creating..." : "Create Wallet"}
              </button>
            </div>
          </div>
        )}

        {/* Import private key */}
        {mode === "import" && (
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Private key (0x...)"
              value={privateKeyInput}
              onChange={(e) => setPrivateKeyInput(e.target.value)}
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-emerald-500 placeholder-gray-500"
            />
            <input
              type="password"
              placeholder="Set a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-500"
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleImport()}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-500"
            />

            {displayError && (
              <p className="text-red-400 text-xs">{displayError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMode("menu");
                  setPassword("");
                  setConfirmPw("");
                  setPrivateKeyInput("");
                  setLocalError(null);
                }}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-sm font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={loading}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? "Importing..." : "Import & Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

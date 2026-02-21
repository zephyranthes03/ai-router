import { useState } from "react";
import { useZkProof, type ProofStatus } from "../../hooks/useZkProof";
import { useWallet } from "../../hooks/useWallet";

function formatTimestamp(ts: bigint): string {
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMicrodollars(micro: bigint): string {
  return `$${(Number(micro) / 1_000_000).toFixed(4)}`;
}

function truncateHash(hash: string, chars = 6): string {
  if (!hash || hash === "0x" + "0".repeat(64)) return "—";
  return `${hash.slice(0, chars + 2)}…${hash.slice(-chars)}`;
}

function StatusBadge({ status }: { status: ProofStatus }) {
  const config: Record<ProofStatus, { label: string; color: string }> = {
    idle: { label: "Ready", color: "bg-gray-600" },
    generating: { label: "Generating Proof...", color: "bg-yellow-600 animate-pulse" },
    generated: { label: "Proof Ready", color: "bg-blue-600" },
    submitting: { label: "Submitting On-Chain...", color: "bg-yellow-600 animate-pulse" },
    submitted: { label: "Verified On-Chain", color: "bg-green-600" },
    error: { label: "Error", color: "bg-red-600" },
  };
  const { label, color } = config[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${color}`}>
      {label}
    </span>
  );
}

export default function ZkVerification() {
  const { isConnected } = useWallet();
  const {
    status,
    error,
    lastProof,
    lastTxHash,
    usageRecords,
    isLoadingRecords,
    proofHistory,
    isLoadingHistory,
    usdcTransferCount,
    generateProof,
    isGenerating,
    submitOnChain,
    isSubmitting,
    reset,
  } = useZkProof();

  const [budgetLimit, setBudgetLimit] = useState(0.1);
  const [collapsed, setCollapsed] = useState(false);

  const stats = usageRecords?.stats;
  const hasRecords = stats && stats.count > 0;

  return (
    <div>
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>ZK Verification</span>
          <StatusBadge status={status} />
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${collapsed ? "" : "rotate-180"}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-4">
          {/* Current Session Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
              <div className="text-xs text-gray-400">Requests</div>
              <div className="text-lg font-mono font-semibold text-blue-400">
                {isLoadingRecords ? "..." : stats?.count ?? 0}
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
              <div className="text-xs text-gray-400">Total Cost</div>
              <div className="text-lg font-mono font-semibold text-yellow-400">
                {isLoadingRecords ? "..." : `$${(stats?.totalCost ?? 0).toFixed(4)}`}
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
              <div className="text-xs text-gray-400">Total Tokens</div>
              <div className="text-lg font-mono font-semibold text-gray-300">
                {isLoadingRecords ? "..." : (stats?.totalTokens ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
              <div className="text-xs text-gray-400">Tx Bindings</div>
              <div className="text-lg font-mono font-semibold text-purple-400">
                {usdcTransferCount}
              </div>
            </div>
          </div>

          {/* Proof Generation Controls */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 space-y-3">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Generate AI Accountability Proof
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-400 whitespace-nowrap">
                Budget Limit ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.001"
                value={budgetLimit}
                onChange={(e) => setBudgetLimit(parseFloat(e.target.value) || 0.1)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono text-white w-32 focus:outline-none focus:border-blue-500"
              />
            </div>

            {usdcTransferCount > 0 && (
              <div className="text-xs text-purple-300 bg-purple-900/20 rounded p-2 border border-purple-800">
                {usdcTransferCount} x402 payment tx(es) will be bound to this proof for independent verification.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => generateProof(budgetLimit)}
                disabled={!hasRecords || isGenerating || status === "generated"}
                className="px-4 py-2 rounded text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors"
              >
                {isGenerating ? "Generating..." : "Generate Proof"}
              </button>

              {lastProof && (
                <button
                  onClick={() => submitOnChain()}
                  disabled={!isConnected || isSubmitting}
                  className="px-4 py-2 rounded text-sm font-medium bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors"
                >
                  {isSubmitting ? "Submitting..." : "Submit On-Chain"}
                </button>
              )}

              {(status === "submitted" || status === "error") && (
                <button
                  onClick={reset}
                  className="px-4 py-2 rounded text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>

            {!hasRecords && !isLoadingRecords && (
              <p className="text-xs text-gray-500">
                Make some AI requests first to generate a proof.
              </p>
            )}

            {error && (
              <div className="text-red-400 text-xs bg-red-900/20 rounded p-2 border border-red-800">
                {error}
              </div>
            )}

            {lastProof && (
              <div className="text-xs text-gray-400 bg-gray-800 rounded p-2 space-y-1">
                <div>Requests proved: <span className="text-white font-mono">{lastProof.meta.requestCount}</span></div>
                <div>Budget limit: <span className="text-white font-mono">${lastProof.meta.budgetLimit}</span></div>
                {lastProof.meta.txHashesRoot && lastProof.meta.txHashesRoot !== "0" && (
                  <div>
                    Tx Hashes Root:{" "}
                    <span className="text-purple-300 font-mono text-[10px]">
                      {lastProof.meta.txHashesRoot.slice(0, 20)}...
                    </span>
                  </div>
                )}
                <div>Tx bindings: <span className="text-purple-300 font-mono">{lastProof.meta.txHashCount}</span></div>
                <div>Public signals: <span className="text-white font-mono text-[10px]">{lastProof.publicSignals.join(", ").slice(0, 60)}...</span></div>
              </div>
            )}

            {lastTxHash && (
              <div className="text-xs text-green-400 bg-green-900/20 rounded p-2 border border-green-800">
                Proof verified on-chain!{" "}
                <a
                  href={`https://sepolia.basescan.org/tx/${lastTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  View on Basescan
                </a>
              </div>
            )}
          </div>

          {/* On-chain Proof History */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Verified Proof History
            </div>

            {!isConnected ? (
              <div className="text-gray-500 text-sm py-3 text-center">
                Connect wallet to view proof history
              </div>
            ) : isLoadingHistory ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-3 justify-center">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Loading proof history...
              </div>
            ) : proofHistory.length === 0 ? (
              <div className="text-gray-500 text-sm py-3 text-center">
                No verified proofs yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="px-3 py-2 text-left font-medium text-gray-400">Proof ID</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-400">Requests</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-400">Budget Limit</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-400">Tx Binding</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-400">Verified At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proofHistory.map((proof, i) => (
                      <tr
                        key={proof.proofId}
                        className={`border-b border-gray-800 ${i % 2 === 0 ? "bg-gray-900" : "bg-gray-800"}`}
                      >
                        <td className="px-3 py-2 font-mono text-blue-400">
                          {proof.proofId.slice(0, 10)}...
                        </td>
                        <td className="px-3 py-2 font-mono text-white">
                          {proof.requestCount.toString()}
                        </td>
                        <td className="px-3 py-2 font-mono text-yellow-400">
                          {formatMicrodollars(proof.budgetLimit)}
                        </td>
                        <td className="px-3 py-2 font-mono text-purple-400" title={proof.txHashesRoot}>
                          {truncateHash(proof.txHashesRoot)}
                        </td>
                        <td className="px-3 py-2 text-gray-400">
                          {formatTimestamp(proof.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

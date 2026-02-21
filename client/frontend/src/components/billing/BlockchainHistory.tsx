import { useState } from "react";
import { useUsdcTransfers } from "../../hooks/useUsdcTransfers";
import { useWallet } from "../../hooks/useWallet";

function formatEstimatedTime(ts: number): string {
  const d = new Date(ts);
  const month = d.toLocaleString("en", { month: "short" });
  const day = d.getDate();
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `~ ${month} ${day}, ${year} ${hours}:${mins}`;
}

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function BlockchainHistory() {
  const { isConnected } = useWallet();
  const { data: transfers, isLoading, error } = useUsdcTransfers();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800/50 transition-colors"
      >
        <span>Blockchain Transactions (USDC)</span>
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
        <div className="px-4 pb-4">
          {!isConnected ? (
            <div className="text-gray-500 text-sm py-4 text-center">
              Connect wallet to view blockchain transactions
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-4 justify-center">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Loading transfer history...
            </div>
          ) : error ? (
            <div className="text-red-400 text-sm py-4 text-center">
              Failed to load transfers: {error instanceof Error ? error.message : "Unknown error"}
            </div>
          ) : !transfers || transfers.length === 0 ? (
            <div className="text-gray-500 text-sm py-4 text-center">
              No outgoing USDC transfers found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Tx Hash</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">To</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Amount (USDC)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Est. Time</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Block</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((tx, i) => (
                    <tr
                      key={tx.txHash}
                      className={`border-b border-gray-800 ${i % 2 === 0 ? "bg-gray-900" : "bg-gray-800"}`}
                    >
                      <td className="px-3 py-2">
                        <a
                          href={`https://sepolia.basescan.org/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 font-mono"
                        >
                          {tx.txHash.slice(0, 10)}...
                        </a>
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-400">
                        {shortenAddress(tx.to)}
                      </td>
                      <td className="px-3 py-2 font-mono text-green-400">
                        {tx.amount}
                      </td>
                      <td className="px-3 py-2 text-gray-400">
                        {formatEstimatedTime(tx.estimatedTimestamp)}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-500">
                        {tx.blockNumber.toString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

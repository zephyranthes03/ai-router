import { useState } from "react";
import type { Message } from "../types";
import ProviderBadge from "./ProviderBadge";
import CostBanner from "./CostBanner";

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const [showThinking, setShowThinking] = useState(false);
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-blue-600/20 border border-blue-800"
            : "bg-gray-800 border border-gray-700"
        }`}
      >
        {/* Header for assistant messages */}
        {!isUser && message.provider_name && (
          <div className="flex items-center gap-2 mb-2">
            <ProviderBadge
              name={message.provider_name}
              tier={message.tier || "standard"}
            />
            {message.pii_report && message.pii_report.count > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-orange-900/50 text-orange-400 border border-orange-800">
                {message.pii_report.count} PII
              </span>
            )}
          </div>
        )}

        {/* PII badge for user messages */}
        {isUser && message.pii_report && message.pii_report.count > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-900/50 text-orange-400 border border-orange-800">
              {message.pii_report.count} PII masked
            </span>
            {message.pii_report.has_critical && (
              <span className="text-xs text-red-400">Critical PII detected</span>
            )}
          </div>
        )}

        {/* Message content */}
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>

        {/* Thinking toggle */}
        {message.thinking && (
          <div className="mt-2">
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showThinking ? "Hide thinking" : "Show thinking"}
            </button>
            {showThinking && (
              <div className="mt-1 p-2 text-xs text-gray-500 bg-gray-900 rounded border border-gray-800 whitespace-pre-wrap">
                {message.thinking}
              </div>
            )}
          </div>
        )}

        {/* Cost banner */}
        {message.cost && <CostBanner cost={message.cost} />}

        {/* Timestamp */}
        <div className="text-[10px] text-gray-600 mt-1">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

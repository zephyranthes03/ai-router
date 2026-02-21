import { useState, useRef, useEffect } from "react";
import type { Message, Conversation, AnalyzeResponse, UserSettings } from "../types";
import { useAnalyze } from "../hooks/useAnalyze";
import { useX402Request } from "../hooks/useX402Request";
import { useWallet } from "../hooks/useWallet";
import { logUsage } from "../lib/localApi";
import MessageBubble from "./MessageBubble";
import PiiOverlay from "./PiiOverlay";
import ProviderBadge from "./ProviderBadge";

type ChatState = "idle" | "analyzing" | "review" | "paying" | "error";

/** Replace [PLACEHOLDER] tokens in text with original values from mask_map. */
function unmaskText(text: string, maskMap: Record<string, string>): string {
  if (!maskMap || Object.keys(maskMap).length === 0) return text;
  let result = text;
  for (const [placeholder, original] of Object.entries(maskMap)) {
    result = result.split(placeholder).join(original);
  }
  return result;
}

/** Calculate total charged USDC for the current calendar month across all conversations. */
function getMonthlyCharged(conversations: Conversation[]): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  let total = 0;
  for (const c of conversations) {
    for (const m of c.messages) {
      if (m.cost && m.timestamp >= monthStart) {
        total += m.cost.charged;
      }
    }
  }
  return total;
}

interface ChatProps {
  tier: "budget" | "standard" | "premium";
  speedQualityWeight: number;
  settings: UserSettings | null;
  conversations: Conversation[];
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
}

export default function Chat({ tier, speedQualityWeight, settings, conversations, initialMessages = [], onMessagesChange }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [chatState, setChatState] = useState<ChatState>("idle");
  const [pendingAnalysis, setPendingAnalysis] = useState<AnalyzeResponse | null>(null);
  const [originalInput, setOriginalInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const analyze = useAnalyze();
  const x402Request = useX402Request();
  const { isConnected, isCorrectChain, refetchBalance } = useWallet();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || chatState !== "idle") return;

    setOriginalInput(trimmed);
    setInput("");
    setError(null);
    setChatState("analyzing");

    try {
      const result = await analyze.mutateAsync({
        message: trimmed,
        tier,
        speedQualityWeight,
      });

      const piiMode = settings?.pii_mode ?? "user_select";

      if (piiMode === "none") {
        // No PII filtering — send original text directly
        await sendToProvider(trimmed, result, trimmed);
      } else if (piiMode === "permissive") {
        // Auto-apply permissive masking — no popup
        await sendToProvider(trimmed, result, result.masked_text);
      } else if (piiMode === "strict") {
        // Auto-apply strict masking — no popup
        await sendToProvider(trimmed, result, result.strict_masked_text);
      } else {
        // "user_select" — show popup when PII detected
        if (result.pii_report.masked_count > 0) {
          setPendingAnalysis(result);
          setChatState("review");
        } else {
          await sendToProvider(trimmed, result);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setChatState("error");
    }
  };

  const sendToProvider = async (userText: string, analysis: AnalyzeResponse, textToSend?: string) => {
    setChatState("paying");

    // Add user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userText,
      timestamp: Date.now(),
      pii_report: analysis.pii_report,
    };
    setMessages((prev) => [...prev, userMsg]);

    if (!isConnected || !isCorrectChain) {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Please connect your wallet to Base Sepolia to send paid requests.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
      setChatState("idle");
      return;
    }

    // Monthly budget check
    const monthlyLimit = settings?.monthly_max_budget ?? Infinity;
    const monthlySpent = getMonthlyCharged(conversations);
    if (monthlySpent >= monthlyLimit) {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Monthly budget limit reached ($${monthlySpent.toFixed(4)} / $${monthlyLimit.toFixed(1)} USDC). Increase the limit in Dashboard → Settings to continue.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
      setChatState("idle");
      return;
    }

    try {
      const actualTextToSend = textToSend ?? (analysis.pii_report.count > 0 ? analysis.masked_text : userText);

      // When PII was masked, prepend a system message instructing the AI to
      // preserve placeholder tokens so they can be unmasked in the response.
      const maskedKeys = Object.keys(analysis.mask_map ?? {});
      const aiMessages: { role: "user" | "assistant" | "system"; content: string }[] =
        maskedKeys.length > 0
          ? [
              {
                role: "system",
                content:
                  "Some values in the user's message have been replaced with placeholder tokens " +
                  `(${maskedKeys.join(", ")}). ` +
                  "These represent sensitive data masked for privacy. " +
                  "When writing code or referencing these values in your response, " +
                  "preserve the placeholder tokens exactly as-is. " +
                  "Do not replace them with example values, comments, or remove them.",
              },
              { role: "user", content: actualTextToSend },
            ]
          : [{ role: "user", content: actualTextToSend }];

      // max_tokens is omitted; the server defaults to 4096 then clamps
      // it to the tier limit (budget: 512, standard: 2048, premium: 4096).
      const aiResp = await x402Request.mutateAsync({
        provider_id: analysis.routing.provider_id,
        messages: aiMessages,
        options: {
          extended_thinking: settings?.extended_thinking ?? false,
          thinking_budget: settings?.extended_thinking ? 10000 : undefined,
          requires_web_search: analysis.routing.requires_web_search,
        },
      });

      const tokens = aiResp.response.usage
        ? { input: aiResp.response.usage.input_tokens, output: aiResp.response.usage.output_tokens }
        : undefined;

      const unmaskMap = analysis.mask_map ?? {};
      const unmaskedContent = unmaskText(aiResp.response.content, unmaskMap);

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: unmaskedContent,
        timestamp: Date.now(),
        provider: aiResp.provider_id,
        provider_name: analysis.routing.provider_name,
        tier: analysis.routing.tier,
        cost: aiResp.cost,
        thinking: aiResp.response.thinking,
        tokens,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Immediately refresh wallet balance to reflect payment deduction
      refetchBalance();

      // Fire-and-forget usage logging
      logUsage({
        id: assistantMsg.id,
        timestamp: assistantMsg.timestamp,
        provider_id: aiResp.provider_id,
        provider_name: analysis.routing.provider_name,
        tier: analysis.routing.tier,
        cost: aiResp.cost,
        tokens: tokens ?? { input: 0, output: 0 },
      });
    } catch (e) {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Request failed: ${e instanceof Error ? e.message : "Unknown error"}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    }

    setChatState("idle");
    setPendingAnalysis(null);
  };

  const handlePiiConfirm = (textToSend: string) => {
    if (pendingAnalysis) {
      sendToProvider(originalInput, pendingAnalysis, textToSend);
    }
  };

  const handlePiiCancel = () => {
    setChatState("idle");
    setPendingAnalysis(null);
    setInput(originalInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            Send a message to start chatting
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Status bar */}
      {chatState !== "idle" && chatState !== "review" && (
        <div className="px-4 py-2 border-t border-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            {chatState === "analyzing" && "Analyzing message..."}
            {chatState === "paying" && "Processing x402 payment..."}
            {chatState === "error" && (
              <span className="text-red-400">{error}</span>
            )}
          </div>
        </div>
      )}

      {/* Routing preview */}
      {pendingAnalysis && chatState === "review" && (
        <div className="px-4 py-2 border-t border-gray-800 flex items-center gap-2 text-xs text-gray-400">
          <span>Routed to:</span>
          <ProviderBadge
            name={pendingAnalysis.routing.provider_name}
            tier={pendingAnalysis.routing.tier}
            price={pendingAnalysis.routing.x402_price}
          />
          <span className="text-gray-600">
            {pendingAnalysis.routing.reasoning}
          </span>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-800">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gray-600 placeholder-gray-500"
            disabled={chatState !== "idle"}
          />
          <button
            onClick={handleSubmit}
            disabled={chatState !== "idle" || !input.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {/* PII Overlay */}
      {chatState === "review" && pendingAnalysis && (
        <PiiOverlay
          originalText={originalInput}
          maskedText={pendingAnalysis.masked_text}
          piiReport={pendingAnalysis.pii_report}
          onConfirm={handlePiiConfirm}
          onCancel={handlePiiCancel}
          maskMap={pendingAnalysis.mask_map}
          strictMaskedText={pendingAnalysis.strict_masked_text}
        />
      )}
    </div>
  );
}

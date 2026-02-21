import { useState, useEffect, useCallback } from "react";
import type { UserSettings, Conversation, Message } from "./types";
import { getSettings } from "./lib/localApi";
import { hasInjectedWallet } from "./lib/embeddedWallet";
import Chat from "./components/Chat";
import WalletConnect from "./components/WalletConnect";
import WalletSetup from "./components/WalletSetup";
import PriorityToggle from "./components/PriorityToggle";
import type { TierName } from "./types/tier";
import Dashboard from "./components/Dashboard";
import ConversationList from "./components/ConversationList";
import HeaderCostDisplay from "./components/HeaderCostDisplay";
import BillingPage from "./components/BillingPage";

type Tab = "chat" | "dashboard" | "billing";

const STORAGE_KEY = "ai-gateway-conversations";

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveConversations(convs: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  } catch {
    // localStorage quota exceeded - silently fail
  }
}

function formatDateStr(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayDateStr(): string {
  return formatDateStr(Date.now());
}

function isSameDay(ts: number): boolean {
  const d = new Date(ts);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function createConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    name: todayDateStr(),
    messages: [],
    createdAt: Date.now(),
    isFavorite: false,
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [tier, setTier] = useState<TierName>("standard");
  const [speedQualityWeight, setSpeedQualityWeight] = useState(50);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [{ conversations: initConvs, activeId: initActiveId }] = useState(() => {
    let loaded = loadConversations();
    // Remove past-day conversations that have no messages (empty placeholders)
    loaded = loaded.filter((c) => c.messages.length > 0 || isSameDay(c.createdAt));
    // Auto-create today's conversation if none exist for today
    if (!loaded.some((c) => isSameDay(c.createdAt))) {
      const newConv = createConversation();
      loaded = [newConv, ...loaded];
    }
    saveConversations(loaded);
    const todayConv = loaded.find((c) => isSameDay(c.createdAt));
    const activeId = todayConv ? todayConv.id : loaded.length > 0 ? loaded[0].id : null;
    return { conversations: loaded, activeId };
  });
  const [conversations, setConversations] = useState<Conversation[]>(initConvs);
  const [activeConvId, setActiveConvId] = useState<string | null>(initActiveId);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {});
  }, []);

  // Persist conversations whenever they change
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  const activeConversation = conversations.find((c) => c.id === activeConvId) ?? null;

  const handleNewConversation = useCallback(() => {
    const newConv = createConversation();
    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newConv.id);
    setActiveTab("chat");
  }, []);

  const handleDeleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const filtered = prev.filter((c) => c.id !== id);
        if (activeConvId === id) {
          if (filtered.length > 0) {
            setActiveConvId(filtered[0].id);
          } else {
            // Auto-create a new conversation when all are deleted
            const newConv = createConversation();
            filtered.push(newConv);
            setActiveConvId(newConv.id);
          }
        }
        return filtered;
      });
    },
    [activeConvId],
  );

  const handleRenameConversation = useCallback((id: string, name: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name } : c)),
    );
  }, []);

  const handleToggleFavorite = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, isFavorite: !c.isFavorite } : c,
      ),
    );
  }, []);

  const handleMessagesChange = useCallback(
    (messages: Message[]) => {
      if (!activeConvId) return;
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConvId) return c;
          // Auto-rename: if name is just a date and we have a first user message
          let name = c.name;
          if (/^\d{4}-\d{2}-\d{2}$/.test(name) && messages.length > 0) {
            const firstUserMsg = messages.find((m) => m.role === "user");
            if (firstUserMsg) {
              const words = firstUserMsg.content.split(/\s+/).slice(0, 3).join(" ");
              name = `${formatDateStr(c.createdAt)} - ${words}`;
            }
          }
          return { ...c, messages, name };
        }),
      );
    },
    [activeConvId],
  );

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-60 shrink-0">
          <ConversationList
            conversations={conversations}
            activeId={activeConvId}
            onSelect={(id) => {
              setActiveConvId(id);
              setActiveTab("chat");
            }}
            onNew={handleNewConversation}
            onDelete={handleDeleteConversation}
            onRename={handleRenameConversation}
            onToggleFavorite={handleToggleFavorite}
          />
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors"
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold">ProofRoute AI</h1>
            <nav className="flex gap-1">
              <button
                onClick={() => setActiveTab("chat")}
                className={`px-3 py-1 rounded text-sm ${
                  activeTab === "chat"
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-3 py-1 rounded text-sm ${
                  activeTab === "dashboard"
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab("billing")}
                className={`px-3 py-1 rounded text-sm ${
                  activeTab === "billing"
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Billing
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <HeaderCostDisplay
              conversations={conversations}
              onNavigateToBilling={() => setActiveTab("billing")}
            />
            <PriorityToggle
              tier={tier}
              speedQualityWeight={speedQualityWeight}
              onTierChange={setTier}
              onWeightChange={setSpeedQualityWeight}
            />
            <WalletConnect />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {activeTab === "chat" && (
            <Chat
              key={activeConvId}
              tier={tier}
              speedQualityWeight={speedQualityWeight}
              settings={settings}
              conversations={conversations}
              initialMessages={activeConversation?.messages ?? []}
              onMessagesChange={handleMessagesChange}
            />
          )}
          {activeTab === "dashboard" && (
            <Dashboard onSettingsChange={setSettings} />
          )}
          {activeTab === "billing" && (
            <BillingPage conversations={conversations} />
          )}
        </main>
      </div>

      {/* Embedded wallet setup / unlock modal (only in desktop mode) */}
      {!hasInjectedWallet() && <WalletSetup />}
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import type { Conversation } from "../types";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onToggleFavorite: (id: string) => void;
}

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onToggleFavorite,
}: ConversationListProps) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const sorted = [...conversations].sort((a, b) => {
    // Favorites first, then by creation date descending
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return b.createdAt - a.createdAt;
  });

  const handleRenameSubmit = (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      onRename(id, trimmed);
    }
    setRenamingId(null);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-800">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Conversations
        </span>
        <button
          onClick={onNew}
          className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-800"
          title="New conversation"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map((conv) => (
          <div
            key={conv.id}
            className={`group flex items-center gap-1 px-3 py-2 cursor-pointer border-l-2 transition-colors ${
              activeId === conv.id
                ? "bg-gray-800/70 border-blue-500"
                : "border-transparent hover:bg-gray-800/40"
            }`}
            onClick={() => onSelect(conv.id)}
          >
            {/* Favorite star */}
            {conv.isFavorite && (
              <span className="text-yellow-500 text-xs shrink-0">&#9733;</span>
            )}

            {/* Name or rename input */}
            <div className="flex-1 min-w-0">
              {renamingId === conv.id ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRenameSubmit(conv.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameSubmit(conv.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
                />
              ) : (
                <span className="text-sm text-gray-300 truncate block">
                  {conv.name}
                </span>
              )}
              <span className="text-[10px] text-gray-600">
                {conv.messages.length} messages
              </span>
            </div>

            {/* Menu button */}
            <div className="relative shrink-0" ref={menuOpenId === conv.id ? menuRef : undefined}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(menuOpenId === conv.id ? null : conv.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 p-1 rounded hover:bg-gray-700 transition-all"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>

              {/* Dropdown menu */}
              {menuOpenId === conv.id && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 py-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenameValue(conv.name);
                      setRenamingId(conv.id);
                      setMenuOpenId(null);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    Rename
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(conv.id);
                      setMenuOpenId(null);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    {conv.isFavorite ? "Unfavorite" : "Favorite"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conv.id);
                      setMenuOpenId(null);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {conversations.length === 0 && (
          <div className="px-3 py-4 text-xs text-gray-600 text-center">
            No conversations yet
          </div>
        )}
      </div>
    </div>
  );
}

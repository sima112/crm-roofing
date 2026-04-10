"use client";

import { useEffect, useState } from "react";
import { Clock, Plus, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getConversationsAction,
  getConversationMessagesAction,
  type ConversationSummary,
} from "@/lib/crewbot/actions";
import type { UIMessage } from "ai";

interface ConversationHistoryProps {
  onLoad: (messages: UIMessage[], conversationId: string) => void;
  onNew: () => void;
  currentConvId?: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ConversationHistory({
  onLoad,
  onNew,
  currentConvId,
}: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getConversationsAction().then((data) => {
      if (!cancelled) {
        setConversations(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  async function handleSelect(conv: ConversationSummary) {
    if (loadingId) return;
    setLoadingId(conv.id);
    const messages = await getConversationMessagesAction(conv.id);
    setLoadingId(null);
    onLoad(messages, conv.id);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">History</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={onNew}
        >
          <Plus className="w-3 h-3" />
          New Chat
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">No conversations yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Start chatting with CrewBot to save history.
              </p>
            </div>
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white gap-1"
              onClick={onNew}
            >
              <Plus className="w-3.5 h-3.5" />
              Start a Chat
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelect(conv)}
                disabled={loadingId === conv.id}
                className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3 ${
                  currentConvId === conv.id ? "bg-teal-50 hover:bg-teal-50" : ""
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    currentConvId === conv.id
                      ? "bg-teal-100"
                      : "bg-slate-100"
                  }`}
                >
                  {loadingId === conv.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                  ) : (
                    <MessageSquare
                      className={`w-3.5 h-3.5 ${
                        currentConvId === conv.id ? "text-teal-600" : "text-slate-500"
                      }`}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate leading-tight">
                    {conv.title}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {relativeTime(conv.updated_at)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

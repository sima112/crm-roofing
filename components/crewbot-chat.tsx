"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, getToolName } from "ai";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  X,
  Send,
  Bot,
  User,
  Loader2,
  ChevronDown,
  Wrench,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { UIMessage } from "ai";

// ── Tool label map ─────────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  searchCustomers:     "Searching customers",
  getCustomerDetail:   "Loading customer",
  createCustomer:      "Creating customer",
  searchJobs:          "Searching jobs",
  createJob:           "Creating job",
  updateJobStatus:     "Updating job status",
  createInvoice:       "Creating invoice",
  sendInvoice:         "Sending invoice",
  getBusinessStats:    "Loading stats",
  getUpcomingSchedule: "Checking schedule",
  rescheduleJob:       "Rescheduling job",
};

const STARTER_PROMPTS = [
  "What jobs are scheduled this week?",
  "Show me unpaid invoices",
  "Add a new customer",
  "What's my revenue this month?",
];

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  // Collect text and tool parts
  const parts = message.parts ?? [];

  return (
    <div className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          isUser ? "bg-primary" : "bg-teal-600"
        )}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-white" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-white" />
        )}
      </div>

      <div className={cn("flex flex-col gap-1.5 max-w-[80%]", isUser && "items-end")}>
        {parts.map((part, i) => {
          // Text part
          if (part.type === "text") {
            if (!part.text) return null;
            return (
              <div
                key={i}
                className={cn(
                  "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                  isUser
                    ? "bg-primary text-white rounded-tr-sm"
                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
                )}
              >
                {part.text}
              </div>
            );
          }

          // Tool invocation part (dynamic tools from server)
          if (isToolUIPart(part)) {
            const name = getToolName(part);
            const label = TOOL_LABELS[name] ?? `Using ${name}`;
            const isDone =
              "state" in part &&
              part.state === "output-available";

            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border self-start",
                  isDone
                    ? "bg-teal-50 text-teal-700 border-teal-200"
                    : "bg-slate-50 text-slate-500 border-slate-200"
                )}
              >
                {isDone ? (
                  <Wrench className="w-3 h-3" />
                ) : (
                  <Loader2 className="w-3 h-3 animate-spin" />
                )}
                {isDone ? `${label} ✓` : `${label}…`}
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface CrewBotChatProps {
  open: boolean;
  onClose: () => void;
}

export function CrewBotChat({ open, onClose }: CrewBotChatProps) {
  const [inputValue, setInputValue] = useState("");
  const [atBottom, setAtBottom] = useState(true);

  const conversationIdRef = useRef<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build transport once — custom fetch captures X-Conversation-Id header
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ conversationId: conversationIdRef.current }),
        fetch: async (url, init) => {
          const response = await fetch(url as string, init as RequestInit);
          const id = response.headers.get("X-Conversation-Id");
          if (id) conversationIdRef.current = id;
          return response;
        },
      }),
    []
  );

  const { messages, sendMessage, status, error, stop, setMessages } = useChat({
    transport,
    onError: (err) => console.error("CrewBot error:", err),
  });

  const isLoading = status === "submitted" || status === "streaming";
  const isEmpty = messages.length === 0;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (atBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, atBottom]);

  // Focus textarea when drawer opens
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [open]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAtBottom(isNearBottom);
  }

  async function handleSend() {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue("");
    await sendMessage({ text });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleStarterPrompt(prompt: string) {
    setInputValue(prompt);
    textareaRef.current?.focus();
  }

  function handleReset() {
    setMessages([]);
    conversationIdRef.current = undefined;
    setInputValue("");
    textareaRef.current?.focus();
  }

  return (
    <>
      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed z-50 flex flex-col bg-slate-50 shadow-2xl transition-transform duration-300 ease-in-out",
          // Mobile: bottom sheet
          "bottom-0 left-0 right-0 h-[88vh] rounded-t-2xl",
          // Desktop: right side panel
          "md:top-0 md:bottom-0 md:left-auto md:right-0 md:h-full md:w-[420px] md:rounded-none md:rounded-l-2xl",
          open
            ? "translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-y-0 md:translate-x-full"
        )}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-teal-700 text-white shrink-0 rounded-t-2xl md:rounded-tl-2xl md:rounded-tr-none">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">CrewBot</p>
              <p className="text-teal-200 text-xs leading-tight">AI assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={handleReset}
                title="New conversation"
                className="p-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              title="Close"
              className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        >
          {isEmpty ? (
            /* Welcome screen */
            <div className="flex flex-col items-center justify-center h-full gap-6 pb-8">
              <div className="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-slate-800 text-base">Hey, I&apos;m CrewBot!</h3>
                <p className="text-slate-500 text-sm mt-1 leading-relaxed max-w-[260px]">
                  Ask me anything about your customers, jobs, or invoices.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-[280px]">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleStarterPrompt(prompt)}
                    className="text-left text-sm px-4 py-2.5 rounded-xl border border-teal-200 bg-white hover:bg-teal-50 hover:border-teal-400 text-teal-800 transition-colors shadow-sm"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && <TypingIndicator />}
              {error && (
                <div className="flex flex-col items-center gap-2 py-3">
                  <p className="text-sm text-red-600 text-center px-4">
                    {error.message?.includes("daily AI limit")
                      ? error.message
                      : "Something went wrong. Try again."}
                  </p>
                  <Button size="sm" variant="outline" onClick={handleReset}>
                    Start over
                  </Button>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Scroll-to-bottom button */}
        {!atBottom && messages.length > 0 && (
          <button
            onClick={() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
              setAtBottom(true);
            }}
            className="absolute bottom-[88px] right-4 w-8 h-8 bg-white border border-slate-200 rounded-full shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors"
          >
            <ChevronDown className="w-4 h-4 text-slate-600" />
          </button>
        )}

        {/* Input area */}
        <div className="shrink-0 px-3 py-3 bg-white border-t border-slate-200">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask CrewBot anything…"
              rows={1}
              className="flex-1 resize-none min-h-[40px] max-h-[120px] text-sm rounded-xl border-slate-200 focus:border-teal-400 focus:ring-teal-400 py-2.5 px-3"
              disabled={isLoading}
            />
            {isLoading ? (
              <Button
                type="button"
                size="icon"
                onClick={() => stop()}
                className="shrink-0 w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600"
                title="Stop generating"
              >
                <X className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="shrink-0 w-10 h-10 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40"
                title="Send (Enter)"
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-center text-xs text-slate-400 mt-2">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
}

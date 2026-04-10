"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, getToolName } from "ai";
import type { UIMessage } from "ai";
import {
  X,
  Send,
  Bot,
  User,
  Loader2,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Clock,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getPageContextFromPath,
  getContextGreeting,
  QUICK_ACTIONS,
  type PageContext,
} from "@/lib/crewbot/context";
import { ToolResultRenderer } from "./message-renderers";
import { QuickActions } from "./quick-actions";
import { ConversationHistory } from "./conversation-history";

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

// ── Onboarding messages (shown only once) ─────────────────────────────────────

const ONBOARDING_MESSAGES = [
  "Hey! I'm CrewBot, your AI assistant. I can help you manage your business without touching a single button.",
  'Try asking me things like:\n\n• "Schedule a roof inspection for tomorrow at 10am"\n• "How much did we make this month?"\n• "Create an invoice for the Johnson job"\n• "Send a payment reminder to overdue customers"',
  "I'll always confirm before making changes. What can I help with?",
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderTextWithBasicMarkdown(text: string) {
  // Split on \n\n for paragraphs, handle bullet points
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, i) => {
    const lines = para.split("\n");
    if (lines.every((l) => l.startsWith("•") || l.startsWith("- ") || l.startsWith("* "))) {
      return (
        <ul key={i} className="list-none space-y-0.5 my-1">
          {lines.map((line, j) => (
            <li key={j} className="flex gap-1.5">
              <span className="text-teal-500 shrink-0">•</span>
              <span>{line.replace(/^[•\-\*]\s*/, "")}</span>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className={i > 0 ? "mt-2" : ""}>
        {para}
      </p>
    );
  });
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
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

      <div
        className={cn(
          "flex flex-col gap-1.5 max-w-[82%]",
          isUser && "items-end"
        )}
      >
        {parts.map((part, i) => {
          // Plain text
          if (part.type === "text") {
            if (!part.text) return null;
            return (
              <div
                key={i}
                className={cn(
                  "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                  isUser
                    ? "bg-primary text-white rounded-tr-sm"
                    : "bg-slate-100 text-slate-800 rounded-tl-sm"
                )}
              >
                {isUser ? (
                  <span className="whitespace-pre-wrap">{part.text}</span>
                ) : (
                  <div className="whitespace-pre-wrap">
                    {renderTextWithBasicMarkdown(part.text)}
                  </div>
                )}
              </div>
            );
          }

          // Tool invocation part
          if (isToolUIPart(part)) {
            const name = getToolName(part);
            const label = TOOL_LABELS[name] ?? `Using ${name}`;
            const isDone = "state" in part && part.state === "output-available";
            const hasOutput = isDone && "output" in part;

            return (
              <div key={i} className="flex flex-col gap-1.5 self-start">
                {/* Tool status pill */}
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border self-start",
                    isDone
                      ? "bg-teal-50 text-teal-700 border-teal-200"
                      : "bg-slate-50 text-slate-500 border-slate-200"
                  )}
                >
                  {isDone ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  ) : (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  )}
                  {isDone ? `${label} ✓` : `${label}…`}
                </div>

                {/* Rich card output */}
                {hasOutput && (
                  <ToolResultRenderer
                    toolName={name}
                    output={(part as { output: unknown }).output}
                  />
                )}
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
      <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center shrink-0">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

// ── Empty / welcome state ──────────────────────────────────────────────────────

function EmptyState({
  greeting,
  quickActions,
  onQuickAction,
}: {
  greeting: string;
  quickActions: string[];
  onQuickAction: (t: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-6 py-8 text-center">
      <div className="w-14 h-14 bg-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
        <Sparkles className="w-7 h-7 text-white" />
      </div>
      <div>
        <h3 className="font-semibold text-slate-800">Hey, I&apos;m CrewBot!</h3>
        <p className="text-slate-500 text-sm mt-1 leading-relaxed max-w-[260px]">
          {greeting}
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-[280px]">
        {quickActions.map((action) => (
          <button
            key={action}
            onClick={() => onQuickAction(action)}
            className="text-left text-sm px-4 py-2.5 rounded-xl border border-teal-200 bg-white hover:bg-teal-50 hover:border-teal-400 text-teal-800 transition-colors shadow-sm"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Onboarding view ────────────────────────────────────────────────────────────

function OnboardingView({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);

  // Auto-advance through messages
  useEffect(() => {
    if (step >= ONBOARDING_MESSAGES.length - 1) return;
    const timer = setTimeout(() => setStep((s) => s + 1), 1200);
    return () => clearTimeout(timer);
  }, [step]);

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex-1 flex flex-col gap-3 justify-end pb-4">
        {ONBOARDING_MESSAGES.slice(0, step + 1).map((msg, i) => (
          <div key={i} className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[82%] text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
              {msg}
            </div>
          </div>
        ))}
        {step < ONBOARDING_MESSAGES.length - 1 && <TypingIndicator />}
      </div>
      {step >= ONBOARDING_MESSAGES.length - 1 && (
        <button
          onClick={onDone}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors self-center"
        >
          Skip intro
        </button>
      )}
    </div>
  );
}

// ── Main ChatPanel ─────────────────────────────────────────────────────────────

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ChatPanel({ open, onClose }: ChatPanelProps) {
  const pathname = usePathname();

  const [inputValue, setInputValue] = useState("");
  const [view, setView] = useState<"chat" | "history">("chat");
  const [isWelcomed, setIsWelcomed] = useState(true);
  const [atBottom, setAtBottom] = useState(true);

  const conversationIdRef = useRef<string | undefined>(undefined);
  const contextRef = useRef<PageContext>(getPageContextFromPath(pathname));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep context ref updated on navigation
  useEffect(() => {
    contextRef.current = getPageContextFromPath(pathname);
  }, [pathname]);

  // Check localStorage for onboarding state
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsWelcomed(!!localStorage.getItem("crewbot_welcomed"));
    }
  }, []);

  // Build transport once
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages,
            conversationId: conversationIdRef.current,
            context: contextRef.current,
          },
        }),
        fetch: async (url, init) => {
          const res = await fetch(url as string, init as RequestInit);
          const id = res.headers.get("X-Conversation-Id");
          if (id) conversationIdRef.current = id;
          return res;
        },
      }),
    []
  );

  const { messages, sendMessage, status, stop, setMessages, error } = useChat({
    transport,
    onError: (err) => console.error("CrewBot error:", err),
  });

  const isLoading = status === "submitted" || status === "streaming";
  const isEmpty = messages.length === 0;
  const pageCtx = getPageContextFromPath(pathname);
  const quickActions = QUICK_ACTIONS[pageCtx.page];
  const greeting = getContextGreeting(pageCtx);

  // Auto-scroll
  useEffect(() => {
    if (atBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, atBottom]);

  // Focus textarea when opened
  useEffect(() => {
    if (open && view === "chat") {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [open, view]);

  // Auto-start new conversation if last one was > 4 hours ago
  useEffect(() => {
    if (!open) return;
    const lastTs = localStorage.getItem("crewbot_last_message_at");
    if (lastTs) {
      const ageMs = Date.now() - parseInt(lastTs, 10);
      if (ageMs > 4 * 60 * 60 * 1000) {
        handleReset();
      }
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  }

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text ?? inputValue).trim();
      if (!msg || isLoading) return;
      if (text === undefined) setInputValue("");

      if (!isWelcomed) {
        localStorage.setItem("crewbot_welcomed", "1");
        setIsWelcomed(true);
      }
      localStorage.setItem("crewbot_last_message_at", Date.now().toString());

      await sendMessage({ text: msg });
    },
    [inputValue, isLoading, isWelcomed, sendMessage]
  );

  function handleReset() {
    setMessages([]);
    conversationIdRef.current = undefined;
    setInputValue("");
    setView("chat");
  }

  function handleLoadConversation(msgs: UIMessage[], convId: string) {
    setMessages(msgs);
    conversationIdRef.current = convId;
    setView("chat");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const showOnboarding = isEmpty && !isWelcomed;
  const showEmptyState = isEmpty && isWelcomed;

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[55] bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed z-[60] flex flex-col bg-white shadow-2xl transition-all duration-300 ease-in-out",
          // Mobile: bottom sheet
          "inset-x-0 bottom-0 h-[92vh] rounded-t-2xl",
          // Desktop: right side panel
          "md:inset-x-auto md:top-0 md:right-0 md:bottom-0 md:h-full md:w-[420px] md:rounded-none md:rounded-l-2xl",
          open
            ? "translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-y-0 md:translate-x-full"
        )}
        aria-hidden={!open}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-teal-700 text-white shrink-0 rounded-t-2xl md:rounded-tl-2xl md:rounded-tr-none">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">CrewBot</p>
              <p className="text-teal-200 text-xs leading-tight">AI Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setView((v) => (v === "history" ? "chat" : "history"))}
              title="Conversation history"
              className={cn(
                "p-2 rounded-lg transition-colors",
                view === "history"
                  ? "bg-white/30 text-white"
                  : "hover:bg-white/20 text-teal-200 hover:text-white"
              )}
            >
              <Clock className="w-4 h-4" />
            </button>
            {messages.length > 0 && view === "chat" && (
              <button
                onClick={handleReset}
                title="New conversation"
                className="p-2 rounded-lg hover:bg-white/20 text-teal-200 hover:text-white transition-colors"
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

        {/* ── Content ── */}
        {view === "history" ? (
          <ConversationHistory
            onLoad={handleLoadConversation}
            onNew={() => {
              handleReset();
            }}
            currentConvId={conversationIdRef.current}
          />
        ) : (
          <>
            {/* Messages area */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto relative"
            >
              {showOnboarding ? (
                <OnboardingView
                  onDone={() => {
                    localStorage.setItem("crewbot_welcomed", "1");
                    setIsWelcomed(true);
                  }}
                />
              ) : showEmptyState ? (
                <EmptyState
                  greeting={greeting}
                  quickActions={quickActions}
                  onQuickAction={(t) => void handleSend(t)}
                />
              ) : (
                <div className="p-4 space-y-4">
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleReset}
                      >
                        Start over
                      </Button>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Scroll-to-bottom */}
            {!atBottom && messages.length > 0 && (
              <button
                onClick={() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                  setAtBottom(true);
                }}
                className="absolute bottom-[100px] right-4 w-8 h-8 bg-white border border-slate-200 rounded-full shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors z-10"
              >
                <ChevronDown className="w-4 h-4 text-slate-600" />
              </button>
            )}

            {/* Input area */}
            <div className="shrink-0 border-t border-slate-100 bg-white">
              {/* Quick action chips — only in empty state within the input bar */}
              {!isEmpty && quickActions.length > 0 && (
                <div className="px-3 pt-2">
                  <QuickActions
                    actions={quickActions}
                    onSelect={(t) => void handleSend(t)}
                  />
                </div>
              )}
              <div className="flex items-end gap-2 px-3 py-2.5">
                <Textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask CrewBot anything…"
                  rows={1}
                  disabled={isLoading}
                  className="flex-1 resize-none min-h-[40px] max-h-[120px] text-sm rounded-xl border-slate-200 focus:border-teal-400 focus:ring-teal-400 py-2.5 px-3"
                />
                <button
                  type="button"
                  title="Voice (coming soon)"
                  disabled
                  className="shrink-0 w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-300 cursor-not-allowed"
                >
                  <Mic className="w-4 h-4" />
                </button>
                {isLoading ? (
                  <Button
                    type="button"
                    size="icon"
                    onClick={() => stop()}
                    className="shrink-0 w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600"
                    title="Stop"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="icon"
                    onClick={() => void handleSend()}
                    disabled={!inputValue.trim()}
                    className="shrink-0 w-10 h-10 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40"
                    title="Send (Enter)"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-center text-[10px] text-slate-400 pb-2">
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}

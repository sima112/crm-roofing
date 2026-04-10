"use client";

import { useState, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./chat-panel";

/**
 * Intercom-style floating circular button — bottom-right corner.
 * Pulses on first visit (until dismissed), then goes solid teal.
 */
export function ChatButton() {
  const [open, setOpen] = useState(false);
  const [firstVisit, setFirstVisit] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const seen = localStorage.getItem("crewbot_button_seen");
      if (!seen) setFirstVisit(true);
    }
  }, []);

  // Listen for sidebar button clicks
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("crewbot:open", handler);
    return () => window.removeEventListener("crewbot:open", handler);
  }, []);

  function handleOpen() {
    setOpen(true);
    if (firstVisit) {
      setFirstVisit(false);
      localStorage.setItem("crewbot_button_seen", "1");
    }
  }

  return (
    <>
      {/* Floating button — hidden while panel is open */}
      <button
        onClick={handleOpen}
        aria-label="Open CrewBot AI assistant"
        className={cn(
          "fixed bottom-6 right-5 z-50",
          "w-14 h-14 rounded-full",
          "bg-teal-600 hover:bg-teal-700 text-white",
          "shadow-xl hover:shadow-2xl",
          "flex items-center justify-center",
          "transition-all duration-200 active:scale-95",
          // Pulse ring on first visit
          firstVisit && "animate-pulse-ring",
          open && "opacity-0 pointer-events-none scale-90"
        )}
      >
        <MessageCircle className="w-6 h-6" strokeWidth={2} />

        {/* Animated ring for first visit */}
        {firstVisit && (
          <span
            className="absolute inset-0 rounded-full bg-teal-500 opacity-30 animate-ping"
            aria-hidden
          />
        )}
      </button>

      <ChatPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

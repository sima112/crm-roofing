"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CrewBotChat } from "@/components/crewbot-chat";

/**
 * Floating CrewBot button + chat drawer.
 * Rendered in the dashboard layout; visible on both mobile and desktop.
 */
export function CrewBotButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating action button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open CrewBot AI assistant"
        className={cn(
          "fixed bottom-6 left-4 z-40 flex items-center gap-2",
          "bg-teal-600 hover:bg-teal-700 text-white",
          "rounded-full shadow-lg transition-all duration-200",
          // On mobile: icon only (sits left side, FAB sits right)
          "w-12 h-12 justify-center",
          // On desktop: pill with label
          "md:w-auto md:h-auto md:px-4 md:py-2.5 md:rounded-full",
          // Hide when chat is open so it doesn't overlap
          open && "opacity-0 pointer-events-none"
        )}
      >
        <Sparkles className="w-5 h-5 shrink-0" />
        <span className="hidden md:inline text-sm font-semibold">CrewBot</span>
      </button>

      <CrewBotChat open={open} onClose={() => setOpen(false)} />
    </>
  );
}

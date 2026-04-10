"use client";

import { cn } from "@/lib/utils";

interface QuickActionsProps {
  actions: string[];
  onSelect: (action: string) => void;
  className?: string;
}

export function QuickActions({ actions, onSelect, className }: QuickActionsProps) {
  if (!actions.length) return null;

  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto pb-1 scrollbar-none",
        className
      )}
      style={{ scrollbarWidth: "none" }}
    >
      {actions.map((action) => (
        <button
          key={action}
          onClick={() => onSelect(action)}
          className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-teal-200 bg-white text-teal-700 hover:bg-teal-50 hover:border-teal-400 transition-colors whitespace-nowrap shadow-sm"
        >
          {action}
        </button>
      ))}
    </div>
  );
}

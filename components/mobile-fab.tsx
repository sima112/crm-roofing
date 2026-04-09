"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Plus, X, Wrench, Users, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIONS: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  { href: "/jobs/new",      label: "New Job",      icon: Wrench,   color: "bg-blue-500 hover:bg-blue-600" },
  { href: "/customers",     label: "New Customer", icon: Users,    color: "bg-violet-500 hover:bg-violet-600" },
  { href: "/invoices/new",  label: "New Invoice",  icon: FileText, color: "bg-amber-500 hover:bg-amber-600" },
];

export function MobileFAB() {
  const [open, setOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* FAB group */}
      <div
        ref={fabRef}
        className="fixed bottom-6 right-4 z-50 flex flex-col-reverse items-end gap-3 md:hidden"
      >
        {/* Action buttons — only shown when open */}
        {open &&
          ACTIONS.map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-2xl px-4 py-3 text-white text-sm font-semibold shadow-lg transition-colors",
                color
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}

        {/* Main FAB button */}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Quick actions"}
          className={cn(
            "w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200",
            open
              ? "bg-slate-700 hover:bg-slate-800 rotate-45"
              : "bg-primary hover:bg-primary/90"
          )}
        >
          {open ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Plus className="w-6 h-6 text-white" />
          )}
        </button>
      </div>
    </>
  );
}

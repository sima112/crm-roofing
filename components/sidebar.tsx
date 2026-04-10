"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Wrench,
  FileText,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/customers", icon: Users, label: "Customers" },
  { href: "/jobs", icon: Wrench, label: "Jobs" },
  { href: "/invoices", icon: FileText, label: "Invoices" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

function openCrewBot() {
  window.dispatchEvent(new CustomEvent("crewbot:open"));
}

export function Sidebar({ businessName }: { businessName?: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 overflow-y-auto">
      {/* Logo + business name */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-sidebar-border">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
          <Wrench className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-white text-sm leading-tight tracking-tight">
            {businessName ?? "CrewBooks"}
          </span>
          {businessName && (
            <span className="text-sidebar-foreground/50 text-xs leading-tight">
              CrewBooks
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* CrewBot button */}
      <div className="px-3 pb-3">
        <button
          onClick={openCrewBot}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-white/10 hover:text-white transition-colors"
        >
          <Sparkles className="w-5 h-5 shrink-0 text-teal-400" />
          <span>CrewBot AI</span>
          <span className="ml-auto text-[10px] bg-teal-500/30 text-teal-300 px-1.5 py-0.5 rounded-full font-semibold">
            NEW
          </span>
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 border-t border-sidebar-border pt-3">
        <p className="text-xs text-sidebar-foreground/40 px-2">
          CrewBooks v0.1
        </p>
      </div>
    </aside>
  );
}

/** Render nav items — reused inside the mobile Sheet */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-3 py-4">
      {navItems.map(({ href, icon: Icon, label }) => {
        const isActive =
          pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-white"
                : "text-foreground hover:bg-muted"
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}

      {/* CrewBot AI */}
      <button
        onClick={() => { onNavigate?.(); openCrewBot(); }}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors w-full text-left"
      >
        <Sparkles className="w-5 h-5 shrink-0 text-teal-500" />
        <span>CrewBot AI</span>
        <span className="ml-auto text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-semibold">
          NEW
        </span>
      </button>
    </nav>
  );
}

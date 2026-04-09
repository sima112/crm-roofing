"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, LogOut, User, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SidebarNav } from "@/components/sidebar";

interface TopNavProps {
  businessName?: string;
  userEmail?: string;
}

export function TopNav({ businessName = "My Business", userEmail }: TopNavProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  const initials = businessName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur px-4 md:px-6">
      {/* Mobile menu button */}
      <button
        className="md:hidden p-1.5 rounded-md hover:bg-muted transition-colors"
        onClick={() => setSheetOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile logo */}
      <div className="flex md:hidden items-center gap-2 flex-1">
        <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
          <Wrench className="w-3 h-3 text-white" />
        </div>
        <span className="font-semibold text-sm">CrewBooks</span>
      </div>

      {/* Desktop business name */}
      <span className="hidden md:block text-sm font-semibold text-muted-foreground flex-1">
        {businessName}
      </span>

      {/* User avatar + dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarFallback className="bg-primary text-white text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{businessName}</p>
              {userEmail && (
                <p className="text-xs text-muted-foreground truncate">
                  {userEmail}
                </p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <User className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mobile navigation Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar">
          <SheetHeader className="px-5 py-4 border-b border-sidebar-border">
            <SheetTitle className="flex items-center gap-2.5 text-white">
              <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
                <Wrench className="w-3.5 h-3.5 text-white" />
              </div>
              CrewBooks
            </SheetTitle>
          </SheetHeader>
          <SidebarNav onNavigate={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}

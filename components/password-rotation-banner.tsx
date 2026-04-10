"use client";

import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";

interface PasswordRotationBannerProps {
  status: "warning" | "expired";
  daysLeft?: number;
}

export function PasswordRotationBanner({ status, daysLeft }: PasswordRotationBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed && status === "warning") return null;

  const isExpired = status === "expired";

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
      isExpired
        ? "bg-destructive text-destructive-foreground"
        : "bg-yellow-50 border-b border-yellow-200 text-yellow-900"
    }`}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <p className="flex-1">
        {isExpired ? (
          <>Your password has expired. <Link href="/settings?tab=account" className="font-semibold underline">Change it now</Link> to continue using CrewBooks.</>
        ) : (
          <>Your password expires in <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong>. <Link href="/settings?tab=account" className="font-semibold underline">Update it now</Link>.</>
        )}
      </p>
      {!isExpired && (
        <button onClick={() => setDismissed(true)} aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

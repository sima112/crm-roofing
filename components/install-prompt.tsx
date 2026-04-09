"use client";

import { useEffect, useState } from "react";
import { X, Share, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type PromptState = "hidden" | "android" | "ios";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "crewbooks-install-dismissed";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

function isInStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

export function InstallPrompt() {
  const [promptState, setPromptState] = useState<PromptState>("hidden");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Already installed — don't show
    if (isInStandaloneMode()) return;

    // Already dismissed this session
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    if (isIOS()) {
      setPromptState("ios");
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPromptState("android");
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setPromptState("hidden");
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setPromptState("hidden");
    }
    setDeferredPrompt(null);
  };

  if (promptState === "hidden") return null;

  return (
    <div className="sticky top-14 z-30 mx-4 mt-3 mb-0 md:mx-6">
      <div className="flex items-center gap-3 rounded-xl border bg-teal-50 border-teal-200 px-4 py-3 shadow-sm">
        {/* Icon */}
        <div className="w-9 h-9 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold leading-none">CB</span>
        </div>

        {promptState === "android" ? (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-teal-900 leading-tight">
                Install CrewBooks
              </p>
              <p className="text-xs text-teal-700 mt-0.5">
                Add to your home screen for quick field access
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleInstall}
              className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white h-8 px-3 text-xs"
            >
              <Download className="w-3 h-3 mr-1" />
              Install
            </Button>
          </>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-teal-900 leading-tight">
                Add to Home Screen
              </p>
              <p className="text-xs text-teal-700 mt-0.5 flex items-center gap-1 flex-wrap">
                Tap
                <Share className="w-3 h-3 inline" />
                <strong>Share</strong>
                then
                <strong>Add to Home Screen</strong>
              </p>
            </div>
          </>
        )}

        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 p-1.5 rounded-md hover:bg-teal-100 text-teal-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

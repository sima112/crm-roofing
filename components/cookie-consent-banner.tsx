"use client";

import { useState, useEffect } from "react";
import { X, Cookie, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type ConsentPreferences = {
  analytics_tracking: boolean;
  marketing_emails: boolean;
  sms_notifications: boolean;
  data_sharing: boolean;
};

const COOKIE_NAME   = "crewbooks_consent";
const COOKIE_EXPIRY = 365; // days

function getStoredConsent(): (ConsentPreferences & { decided: boolean }) | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(COOKIE_NAME + "="));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match.split("=").slice(1).join("=")));
  } catch {
    return null;
  }
}

function setConsentCookie(prefs: ConsentPreferences & { decided: boolean }) {
  const value  = encodeURIComponent(JSON.stringify(prefs));
  const maxAge = COOKIE_EXPIRY * 24 * 60 * 60;
  document.cookie = `${COOKIE_NAME}=${value}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

/** Check Global Privacy Control — if set, default to opt-out */
function gpcEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator as unknown as Record<string, unknown>)["globalPrivacyControl"] === true;
}

const OPTIONAL_TOGGLES: {
  key: keyof ConsentPreferences;
  label: string;
  description: string;
  required?: boolean;
}[] = [
  {
    key: "analytics_tracking",
    label: "Analytics & usage data",
    description: "Helps us understand how you use the app so we can improve it. No PII is shared.",
  },
  {
    key: "marketing_emails",
    label: "Product updates & tips",
    description: "Occasional emails about new features and best practices. Unsubscribe any time.",
  },
  {
    key: "sms_notifications",
    label: "SMS reminders",
    description: "Automated SMS sent to your customers for invoice reminders and job updates.",
  },
  {
    key: "data_sharing",
    label: "Third-party integrations",
    description: "Allows data to flow to connected services like QuickBooks. Required for those features.",
  },
];

export function CookieConsentBanner() {
  const [visible, setVisible]   = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [prefs, setPrefs]       = useState<ConsentPreferences>({
    analytics_tracking: false,
    marketing_emails:   false,
    sms_notifications:  false,
    data_sharing:       false,
  });

  useEffect(() => {
    const stored = getStoredConsent();
    if (stored?.decided) {
      setVisible(false);
      return;
    }

    // Respect GPC — immediately opt out of optional cookies
    if (gpcEnabled()) {
      acceptSelected({ analytics_tracking: false, marketing_emails: false, sms_notifications: false, data_sharing: false });
      return;
    }

    // Small delay so the banner doesn't flash on first paint
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function acceptAll() {
    const all: ConsentPreferences = {
      analytics_tracking: true,
      marketing_emails:   true,
      sms_notifications:  true,
      data_sharing:       true,
    };
    acceptSelected(all);
  }

  function rejectOptional() {
    acceptSelected({ analytics_tracking: false, marketing_emails: false, sms_notifications: false, data_sharing: false });
  }

  function acceptSelected(overridePrefs?: ConsentPreferences) {
    const final = overridePrefs ?? prefs;
    setConsentCookie({ ...final, decided: true });
    setVisible(false);
    // Fire a custom event so any lazy-loaded scripts can react
    window.dispatchEvent(new CustomEvent("crewbooks:consent", { detail: final }));
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur shadow-lg"
    >
      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* Main bar */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <Cookie className="w-5 h-5 text-primary shrink-0 mt-0.5 hidden sm:block" />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">We use cookies to run CrewBooks.</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Essential cookies (authentication, security) are always active. Optional cookies
              help us improve the product.{" "}
              <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
            </p>

            {/* Expandable customize section */}
            {expanded && (
              <div className="mt-3 space-y-3 border rounded-lg p-3 bg-muted/30">
                {/* Required — always on */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">Essential cookies</p>
                    <p className="text-xs text-muted-foreground">
                      Auth session, CSRF protection, and core functionality. Cannot be disabled.
                    </p>
                  </div>
                  <span className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full shrink-0">
                    Always on
                  </span>
                </div>

                <div className="border-t" />

                {OPTIONAL_TOGGLES.map(({ key, label, description }) => (
                  <div key={key} className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{label}</p>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={prefs[key]}
                      onClick={() => setPrefs((p) => ({ ...p, [key]: !p[key] }))}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                        prefs[key] ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                          prefs[key] ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 px-3"
              onClick={() => setExpanded((e) => !e)}
            >
              Customize
              {expanded ? (
                <ChevronUp className="w-3 h-3 ml-1" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-1" />
              )}
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-8 px-3" onClick={rejectOptional}>
              Reject non-essential
            </Button>
            <Button size="sm" className="text-xs h-8 px-3" onClick={expanded ? () => acceptSelected() : acceptAll}>
              {expanded ? "Save preferences" : "Accept all"}
            </Button>
            <button
              onClick={rejectOptional}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close and reject optional cookies"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

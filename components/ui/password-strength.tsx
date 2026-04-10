"use client";

import { checkPasswordStrength } from "@/lib/password-validation";
import { CheckCircle2, XCircle } from "lucide-react";

interface PasswordStrengthMeterProps {
  password: string;
  showChecklist?: boolean;
}

export function PasswordStrengthMeter({ password, showChecklist = true }: PasswordStrengthMeterProps) {
  if (!password) return null;

  const { score, checks, label, color } = checkPasswordStrength(password);

  const segments = [0, 1, 2, 3];

  return (
    <div className="space-y-2 mt-1.5">
      {/* Segmented bar */}
      <div className="flex gap-1">
        {segments.map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? color : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${
        score <= 1 ? "text-red-600" :
        score === 2 ? "text-yellow-600" :
        score === 3 ? "text-blue-600" :
        "text-green-600"
      }`}>
        {label}
      </p>

      {showChecklist && (
        <ul className="space-y-0.5">
          {[
            { key: "length",        label: "At least 10 characters" },
            { key: "uppercase",     label: "Uppercase letter (A-Z)" },
            { key: "lowercase",     label: "Lowercase letter (a-z)" },
            { key: "number",        label: "Number (0-9)" },
            { key: "special",       label: "Special character (!@#$…)" },
            { key: "noConsecutive", label: "No 3 identical characters in a row" },
          ].map(({ key, label: checkLabel }) => {
            const passed = checks[key as keyof typeof checks];
            return (
              <li key={key} className="flex items-center gap-1.5">
                {passed ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                )}
                <span className={`text-xs ${passed ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                  {checkLabel}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

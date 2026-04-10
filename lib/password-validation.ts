/**
 * Password validation helpers — safe to import in client components.
 * No Node.js built-ins, no bcrypt, no fetch.
 */

export interface PasswordChecks {
  length: boolean;        // >= 10 chars
  uppercase: boolean;     // at least one A-Z
  lowercase: boolean;     // at least one a-z
  number: boolean;        // at least one 0-9
  special: boolean;       // at least one non-alphanumeric
  noConsecutive: boolean; // no 3+ consecutive identical chars
}

export interface PasswordStrength {
  score: number;  // 0 (very weak) → 4 (strong)
  checks: PasswordChecks;
  label: string;
  color: string;  // tailwind bg color class
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const checks: PasswordChecks = {
    length:        password.length >= 10,
    uppercase:     /[A-Z]/.test(password),
    lowercase:     /[a-z]/.test(password),
    number:        /[0-9]/.test(password),
    special:       /[^A-Za-z0-9]/.test(password),
    noConsecutive: !/(.)\1\1/.test(password),
  };

  const passed = Object.values(checks).filter(Boolean).length;
  const score  = passed <= 1 ? 0 : passed <= 3 ? 1 : passed <= 4 ? 2 : passed <= 5 ? 3 : 4;

  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"];

  return { score, checks, label: labels[score], color: colors[score] };
}

/** Returns array of human-readable errors (empty array = valid). Client-safe. */
export function validatePasswordComplexity(
  password: string,
  context?: { email?: string; businessName?: string }
): string[] {
  const errors: string[] = [];

  if (password.length < 10)
    errors.push("At least 10 characters required");
  if (!/[A-Z]/.test(password))
    errors.push("At least one uppercase letter (A-Z)");
  if (!/[a-z]/.test(password))
    errors.push("At least one lowercase letter (a-z)");
  if (!/[0-9]/.test(password))
    errors.push("At least one number (0-9)");
  if (!/[^A-Za-z0-9]/.test(password))
    errors.push("At least one special character (!@#$…)");
  if (/(.)\1\1/.test(password))
    errors.push("No more than 2 consecutive identical characters");

  if (context?.email) {
    const local = context.email.split("@")[0].toLowerCase();
    if (local.length > 3 && password.toLowerCase().includes(local))
      errors.push("Password cannot contain your email address");
  }

  if (context?.businessName) {
    const biz = context.businessName.toLowerCase().replace(/\s+/g, "");
    if (biz.length > 3 && password.toLowerCase().replace(/\s+/g, "").includes(biz))
      errors.push("Password cannot contain your business name");
  }

  return errors;
}

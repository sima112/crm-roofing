#!/usr/bin/env tsx
/**
 * Environment variable audit script.
 * Run with: npx tsx scripts/check-env.ts
 *
 * Checks:
 * 1. All required vars are present
 * 2. No secrets are prefixed with NEXT_PUBLIC_ (browser-exposed)
 * 3. Warns if running production without HTTPS
 */

const REQUIRED_VARS: string[] = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "ENCRYPTION_KEY",
];

const OPTIONAL_VARS: string[] = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "QUICKBOOKS_CLIENT_ID",
  "QUICKBOOKS_CLIENT_SECRET",
];

// These must never start with NEXT_PUBLIC_
const SECRET_PATTERNS: string[] = [
  "SERVICE_ROLE",
  "SECRET",
  "PRIVATE",
  "PASSWORD",
  "TOKEN",
  "AUTH_TOKEN",
  "API_KEY",
  "ENCRYPTION",
];

let hasError = false;
let hasWarning = false;

function error(msg: string) {
  console.error(`  ✗ ERROR: ${msg}`);
  hasError = true;
}

function warn(msg: string) {
  console.warn(`  ⚠ WARN:  ${msg}`);
  hasWarning = true;
}

function ok(msg: string) {
  console.log(`  ✓ OK:    ${msg}`);
}

console.log("\n════════════════════════════════════════");
console.log("  CrewBooks — Environment Variable Audit");
console.log("════════════════════════════════════════\n");

// ── 1. Required variables ────────────────────────────────────────────────────
console.log("[ Required Variables ]");
for (const key of REQUIRED_VARS) {
  const val = process.env[key];
  if (!val) {
    error(`${key} is missing`);
  } else if (val.includes("your-") || val.includes("placeholder")) {
    error(`${key} looks like a placeholder value`);
  } else {
    ok(`${key} is set`);
  }
}

// ── 2. Optional variables (warn if missing) ──────────────────────────────────
console.log("\n[ Optional Variables ]");
for (const key of OPTIONAL_VARS) {
  const val = process.env[key];
  if (!val) {
    warn(`${key} is not set — related feature will be disabled`);
  } else {
    ok(`${key} is set`);
  }
}

// ── 3. NEXT_PUBLIC_ exposure check ──────────────────────────────────────────
console.log("\n[ Public Exposure Check ]");
const allEnvKeys = Object.keys(process.env);
let exposureClean = true;

for (const key of allEnvKeys) {
  if (!key.startsWith("NEXT_PUBLIC_")) continue;

  for (const pattern of SECRET_PATTERNS) {
    if (key.toUpperCase().includes(pattern)) {
      error(`${key} starts with NEXT_PUBLIC_ but contains a secret pattern (${pattern}). This will be exposed to browsers!`);
      exposureClean = false;
      break;
    }
  }
}

if (exposureClean) ok("No secrets found in NEXT_PUBLIC_ variables");

// ── 4. HTTPS check ───────────────────────────────────────────────────────────
console.log("\n[ HTTPS Check ]");
const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "";
const nodeEnv = process.env.NODE_ENV;

if (nodeEnv === "production" && appUrl && !appUrl.startsWith("https://")) {
  warn(`Running in production but NEXT_PUBLIC_APP_URL does not use HTTPS: ${appUrl}`);
} else if (appUrl.startsWith("https://")) {
  ok(`NEXT_PUBLIC_APP_URL uses HTTPS`);
} else {
  ok(`Not in production — HTTP is acceptable`);
}

// ── 5. Encryption key length ─────────────────────────────────────────────────
console.log("\n[ Encryption Key Check ]");
const encKey = process.env.ENCRYPTION_KEY;
if (encKey) {
  if (encKey.length < 64) {
    error(`ENCRYPTION_KEY is only ${encKey.length} chars — need 64 hex chars (32 bytes). Run: openssl rand -hex 32`);
  } else {
    ok(`ENCRYPTION_KEY length is valid (${encKey.length} chars)`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n════════════════════════════════════════");
if (hasError) {
  console.error("  RESULT: FAILED — fix the errors above before deploying.\n");
  process.exit(1);
} else if (hasWarning) {
  console.warn("  RESULT: PASSED WITH WARNINGS — some optional features may be disabled.\n");
  process.exit(0);
} else {
  console.log("  RESULT: ALL CHECKS PASSED\n");
  process.exit(0);
}

/**
 * Client-safe permission types and constants.
 * No server-only imports — safe to use in both server and client components.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type Role = "owner" | "admin" | "technician" | "viewer";

export type Permission =
  | "customers:view"
  | "customers:create"
  | "customers:edit"
  | "customers:delete"
  | "jobs:view"
  | "jobs:create"
  | "jobs:edit"
  | "jobs:delete"
  | "invoices:view"
  | "invoices:create"
  | "invoices:send"
  | "invoices:delete"
  | "dashboard:view"
  | "team:manage"
  | "billing:manage"
  | "data:export"
  | "account:delete"
  | "ai:use"
  | "ai:limited";

// ── Permission matrix ─────────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  owner: new Set([
    "customers:view", "customers:create", "customers:edit", "customers:delete",
    "jobs:view",      "jobs:create",      "jobs:edit",      "jobs:delete",
    "invoices:view",  "invoices:create",  "invoices:send",  "invoices:delete",
    "dashboard:view", "team:manage", "billing:manage",
    "data:export", "account:delete", "ai:use",
  ]),
  admin: new Set([
    "customers:view", "customers:create", "customers:edit", "customers:delete",
    "jobs:view",      "jobs:create",      "jobs:edit",      "jobs:delete",
    "invoices:view",  "invoices:create",  "invoices:send",  "invoices:delete",
    "dashboard:view", "team:manage",
    "data:export", "ai:use",
  ]),
  technician: new Set([
    "customers:view", "customers:create", "customers:edit",
    "jobs:view",      "jobs:create",      "jobs:edit",
    "ai:limited",
  ]),
  viewer: new Set([
    "customers:view",
    "jobs:view",
  ]),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  if (permission === "ai:limited") {
    return (
      ROLE_PERMISSIONS[role].has("ai:limited") ||
      ROLE_PERMISSIONS[role].has("ai:use")
    );
  }
  return ROLE_PERMISSIONS[role].has(permission);
}

export function getPermissions(role: Role): Set<Permission> {
  return ROLE_PERMISSIONS[role];
}

// ── Role metadata ─────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<Role, string> = {
  owner:      "Owner",
  admin:      "Admin",
  technician: "Technician",
  viewer:     "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner:      "Full access, billing, and account management",
  admin:      "Full access except billing and account deletion",
  technician: "View/update assigned jobs and customers, no financials",
  viewer:     "Read-only access to jobs and customers",
};

export const INVITABLE_ROLES: Role[] = ["admin", "technician", "viewer"];

export const SEAT_LIMITS: Record<string, number> = {
  trial:     3,
  active:    10,
  past_due:  10,
  cancelled: 1,
};

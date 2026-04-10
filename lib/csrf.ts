/**
 * CSRF protection using the double-submit cookie pattern.
 * - Server sets a `crewbooks_csrf` cookie (httpOnly=false so JS can read it)
 * - Client reads the cookie and sends it as `X-CSRF-Token` header
 * - Server validates header === cookie value
 */

import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const CSRF_COOKIE  = "crewbooks_csrf";
const CSRF_HEADER  = "x-csrf-token";
const TOKEN_LENGTH = 32; // bytes → 64 hex chars

/** Generate a new CSRF token and set it as a cookie in the response. */
export function generateCsrfToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString("hex");
}

/** Read the CSRF token from the request cookies. */
export async function getCsrfToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(CSRF_COOKIE)?.value;
}

/**
 * Middleware helper: validate CSRF for mutating requests (POST/PUT/PATCH/DELETE).
 * Returns null if valid, or a NextResponse(403) if invalid.
 *
 * Usage in API routes:
 *   const csrfError = await validateCsrf(request);
 *   if (csrfError) return csrfError;
 */
export async function validateCsrf(req: NextRequest): Promise<NextResponse | null> {
  const method = req.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return null;

  // Skip for webhook routes (they use signature verification instead)
  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/webhooks/")) return null;

  const cookieToken  = req.cookies.get(CSRF_COOKIE)?.value;
  const headerToken  = req.headers.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) {
    return NextResponse.json({ error: "CSRF token missing" }, { status: 403 });
  }

  // Constant-time comparison to prevent timing attacks
  const cookieBuf = Buffer.from(cookieToken);
  const headerBuf = Buffer.from(headerToken);

  if (
    cookieBuf.length !== headerBuf.length ||
    !crypto.timingSafeEqual(cookieBuf, headerBuf)
  ) {
    return NextResponse.json({ error: "CSRF token invalid" }, { status: 403 });
  }

  return null;
}

/**
 * Set the CSRF cookie on a response (call this when the user loads the page / logs in).
 * The cookie is SameSite=Strict and NOT httpOnly so the client JS can read it.
 */
export function attachCsrfCookie(response: NextResponse, token?: string): NextResponse {
  const value = token ?? generateCsrfToken();
  response.cookies.set(CSRF_COOKIE, value, {
    path:     "/",
    sameSite: "strict",
    secure:   process.env.NODE_ENV === "production",
    httpOnly: false, // intentionally readable by JS for double-submit pattern
    maxAge:   60 * 60 * 24, // 24h
  });
  return response;
}

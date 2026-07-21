import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SESSION_COOKIE = "nbl_admin_session";
const STATE_COOKIE = "nbl_oauth_state";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;

export type AdminSession = {
  login: string;
  avatarUrl: string;
  exp: number;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseCookies(request: VercelRequest): Record<string, string> {
  const header = request.headers.cookie ?? "";
  return Object.fromEntries(
    header.split(";").flatMap((part) => {
      const separator = part.indexOf("=");
      if (separator < 0) return [];
      return [[part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())]];
    })
  );
}

function signature(payload: string): string {
  const secret = requiredEnv("ADMIN_SESSION_SECRET");
  if (secret.length < 32) throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function secureCookie(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

function cookie(name: string, value: string, maxAge: number): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secureCookie() ? "Secure" : "",
    `Max-Age=${maxAge}`
  ].filter(Boolean).join("; ");
}

function appendCookie(response: VercelResponse, value: string): void {
  const current = response.getHeader("Set-Cookie");
  const cookies = current ? (Array.isArray(current) ? current.map(String) : [String(current)]) : [];
  response.setHeader("Set-Cookie", [...cookies, value]);
}

export function issueSession(response: VercelResponse, login: string, avatarUrl: string): void {
  const session: AdminSession = {
    login,
    avatarUrl,
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  appendCookie(response, cookie(SESSION_COOKIE, `${payload}.${signature(payload)}`, SESSION_DURATION_SECONDS));
}

export function readSession(request: VercelRequest): AdminSession | null {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature) return null;

  const expected = Buffer.from(signature(payload));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    if (!session.login || !session.avatarUrl || session.exp <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function requireAdmin(request: VercelRequest, response: VercelResponse): AdminSession | null {
  const session = readSession(request);
  if (!session || !isAllowedAdmin(session.login)) {
    response.status(401).json({ error: "Admin authentication required" });
    return null;
  }
  return session;
}

export function clearSession(response: VercelResponse): void {
  appendCookie(response, cookie(SESSION_COOKIE, "", 0));
}

export function createOAuthState(response: VercelResponse): string {
  const state = randomBytes(24).toString("base64url");
  appendCookie(response, cookie(STATE_COOKIE, state, 10 * 60));
  return state;
}

export function consumeOAuthState(request: VercelRequest, response: VercelResponse, supplied: string): boolean {
  const expected = parseCookies(request)[STATE_COOKIE];
  appendCookie(response, cookie(STATE_COOKIE, "", 0));
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function isAllowedAdmin(login: string): boolean {
  const allowed = requiredEnv("ADMIN_GITHUB_LOGINS")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(login.toLowerCase());
}

export function oauthClientId(): string {
  return requiredEnv("GITHUB_OAUTH_CLIENT_ID");
}

export function oauthClientSecret(): string {
  return requiredEnv("GITHUB_OAUTH_CLIENT_SECRET");
}

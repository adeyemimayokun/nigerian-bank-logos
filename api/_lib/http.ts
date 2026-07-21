import type { VercelRequest, VercelResponse } from "@vercel/node";

export function methodNotAllowed(response: VercelResponse, allowed: string[]): void {
  response.setHeader("Allow", allowed.join(", "));
  response.status(405).json({ error: "Method not allowed" });
}

export function requestOrigin(request: VercelRequest): string {
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProtocol) ? forwardedProtocol[0] : forwardedProtocol ?? "https";
  return `${protocol}://${request.headers.host}`;
}

export function requireSameOrigin(request: VercelRequest, response: VercelResponse): boolean {
  const origin = request.headers.origin;
  if (!origin || origin !== requestOrigin(request)) {
    response.status(403).json({ error: "Invalid request origin" });
    return false;
  }
  return true;
}

export function jsonError(response: VercelResponse, error: unknown, status = 500): void {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  response.status(status).json({ error: message });
}

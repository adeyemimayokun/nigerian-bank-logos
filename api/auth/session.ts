import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAllowedAdmin, readSession } from "../_lib/auth.js";
import { methodNotAllowed } from "../_lib/http.js";

export default function handler(request: VercelRequest, response: VercelResponse): void {
  if (request.method !== "GET") return methodNotAllowed(response, ["GET"]);
  response.setHeader("Cache-Control", "no-store");
  const session = readSession(request);
  if (!session || !isAllowedAdmin(session.login)) {
    response.status(401).json({ authenticated: false });
    return;
  }
  response.status(200).json({ authenticated: true, user: { login: session.login, avatarUrl: session.avatarUrl } });
}

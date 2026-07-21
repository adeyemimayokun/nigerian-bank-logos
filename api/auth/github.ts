import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createOAuthState, oauthClientId } from "../_lib/auth.js";
import { jsonError, methodNotAllowed, requestOrigin } from "../_lib/http.js";

export default function handler(request: VercelRequest, response: VercelResponse): void {
  if (request.method !== "GET") return methodNotAllowed(response, ["GET"]);
  try {
    const state = createOAuthState(response);
    const callback = `${process.env.PUBLIC_SITE_URL ?? requestOrigin(request)}/api/auth/callback`;
    const params = new URLSearchParams({
      client_id: oauthClientId(),
      redirect_uri: callback,
      scope: "read:user",
      state
    });
    response.redirect(302, `https://github.com/login/oauth/authorize?${params.toString()}`);
  } catch (error) {
    jsonError(response, error);
  }
}

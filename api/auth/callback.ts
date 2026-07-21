import type { VercelRequest, VercelResponse } from "@vercel/node";
import { consumeOAuthState, isAllowedAdmin, issueSession, oauthClientId, oauthClientSecret } from "../_lib/auth.js";
import { jsonError, methodNotAllowed, requestOrigin } from "../_lib/http.js";

type TokenResponse = { access_token?: string; error_description?: string };
type GitHubUser = { login: string; avatar_url: string };

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "GET") return methodNotAllowed(response, ["GET"]);
  const code = typeof request.query.code === "string" ? request.query.code : "";
  const state = typeof request.query.state === "string" ? request.query.state : "";
  if (!code || !consumeOAuthState(request, response, state)) {
    response.redirect(302, "/admin?error=invalid-oauth-state");
    return;
  }

  try {
    const callback = `${process.env.PUBLIC_SITE_URL ?? requestOrigin(request)}/api/auth/callback`;
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: oauthClientId(),
        client_secret: oauthClientSecret(),
        code,
        redirect_uri: callback,
        state
      })
    });
    const token = await tokenResponse.json() as TokenResponse;
    if (!tokenResponse.ok || !token.access_token) throw new Error(token.error_description ?? "GitHub sign-in failed");

    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token.access_token}`,
        "User-Agent": "awalogo-cms"
      }
    });
    if (!userResponse.ok) throw new Error("Could not read GitHub account");
    const user = await userResponse.json() as GitHubUser;
    if (!isAllowedAdmin(user.login)) {
      response.redirect(302, "/admin?error=not-authorized");
      return;
    }

    issueSession(response, user.login, user.avatar_url);
    response.redirect(302, "/admin");
  } catch (error) {
    jsonError(response, error);
  }
}

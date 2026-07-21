# Admin CMS

The admin workspace is available at `/admin`. It uses GitHub OAuth for identity, checks the account against an explicit maintainer allowlist, and stores only a signed, short-lived HTTP-only session cookie in the browser.

Catalog changes never write directly to the default branch. Each upload or removal creates an isolated branch and pull request containing the metadata, source SVG, generated PNG/WebP assets, and format-manifest update.

## Deployment setup

1. Create a GitHub OAuth app. Set its callback URL to `https://YOUR_DOMAIN/api/auth/callback`.
2. Add the values from `.env.example` to the Vercel project environment.
3. Create a fine-grained GitHub token restricted to this repository with **Contents: read and write** and **Pull requests: read and write**.
4. Set `ADMIN_GITHUB_LOGINS` to the approved GitHub usernames, separated by commas.
5. Generate `ADMIN_SESSION_SECRET` with `openssl rand -base64 48`.

For local end-to-end testing, use `vercel dev` so both the Vite frontend and `/api` functions are available. The OAuth app needs a matching local callback URL.

## Security controls

- OAuth state verification and an eight-hour signed session.
- HTTP-only, same-site cookies; secure cookies in deployed environments.
- Server-side maintainer allowlist checks on every admin API request.
- Same-origin checks for mutations and logout.
- SVG payload size limits and rejection of scripts, event handlers, embedded HTML, JavaScript URLs, and remote resources.
- Server-only repository credentials and pull-request review before publication.
- Typed confirmation for destructive actions.

New logos are created with `needs-review` status. A maintainer must verify the official source and change the status during pull-request review before the asset appears in the public catalog.

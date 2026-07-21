import { randomBytes } from "node:crypto";

type GitHubContent = { content: string; encoding: string };
type GitRef = { object: { sha: string } };
type GitCommit = { tree: { sha: string } };
type GitBlob = { sha: string };
type PullRequest = { html_url: string; number: number };

export type FileChange = { path: string; content: Buffer | null };

function repository(): { owner: string; repo: string } {
  const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "adeyemimayokun/nigerian-bank-logos").split("/");
  if (!owner || !repo) throw new Error("GITHUB_REPOSITORY must use owner/repository format");
  return { owner, repo };
}

function token(): string {
  if (!process.env.GITHUB_ADMIN_TOKEN) throw new Error("Missing required environment variable: GITHUB_ADMIN_TOKEN");
  return process.env.GITHUB_ADMIN_TOKEN;
}

async function github<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      "User-Agent": "awalogo-cms",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers
    }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub request failed (${response.status}): ${detail.slice(0, 240)}`);
  }
  return response.json() as Promise<T>;
}

export async function readRepositoryJson<T>(path: string): Promise<T> {
  const { owner, repo } = repository();
  const branch = process.env.GITHUB_DEFAULT_BRANCH ?? "main";
  const file = await github<GitHubContent>(`/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`);
  if (file.encoding !== "base64") throw new Error(`Unsupported GitHub encoding for ${path}`);
  return JSON.parse(Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8")) as T;
}

function branchName(action: string, slug: string): string {
  const suffix = randomBytes(3).toString("hex");
  return `cms/${action}-${slug}-${Date.now()}-${suffix}`.slice(0, 240);
}

export async function createCatalogPullRequest(options: {
  action: string;
  slug: string;
  title: string;
  body: string;
  changes: FileChange[];
}): Promise<PullRequest> {
  const { owner, repo } = repository();
  const base = process.env.GITHUB_DEFAULT_BRANCH ?? "main";
  const ref = await github<GitRef>(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(base)}`);
  const commit = await github<GitCommit>(`/repos/${owner}/${repo}/git/commits/${ref.object.sha}`);

  const entries = await Promise.all(options.changes.map(async (change) => {
    if (change.content === null) return { path: change.path, mode: "100644", type: "blob", sha: null };
    const blob = await github<GitBlob>(`/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: change.content.toString("base64"), encoding: "base64" })
    });
    return { path: change.path, mode: "100644", type: "blob", sha: blob.sha };
  }));

  const tree = await github<GitBlob>(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: commit.tree.sha, tree: entries })
  });
  const nextCommit = await github<GitBlob>(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message: options.title, tree: tree.sha, parents: [ref.object.sha] })
  });
  const head = branchName(options.action, options.slug);
  await github(`/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${head}`, sha: nextCommit.sha })
  });
  return github<PullRequest>(`/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title: options.title, body: options.body, head, base })
  });
}

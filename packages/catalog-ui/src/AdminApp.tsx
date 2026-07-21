import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  FileCode2,
  GitFork,
  ImagePlus,
  LoaderCircle,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { logos as bundledLogos } from "./logo-data";
import "./admin.css";

type Session = { login: string; avatarUrl: string };
type Format = { type: string; path: string };
type Variation = { id: string; name: string; source_url?: string; svg_path: string | null; formats: Format[] };
type Logo = {
  name: string;
  slug: string;
  category: string;
  website: string;
  source_url: string;
  svg_path: string | null;
  formats: Format[];
  status: string;
};
type CatalogResponse = { catalog: Logo[]; variations: Record<string, Variation[]>; lockedSlugs: string[] };
type MutationResult = { pullRequest: { number: number; url: string } };

const categories = [
  ["commercial-bank", "Commercial bank"],
  ["microfinance-bank", "Microfinance bank"],
  ["merchant-bank", "Merchant bank"],
  ["payment-bank", "Payment service bank"],
  ["fintech", "Fintech"],
  ["other", "Other"]
] as const;

const sourceTypes = [
  ["official-brand-page", "Official brand page"],
  ["official-website", "Official website"],
  ["annual-report", "Annual report"],
  ["verified-pdf", "Verified PDF"],
  ["other-official", "Other official source"]
] as const;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("The admin API is not available on this development server");
  }
  const body = await response.json() as { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body as T;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the SVG file"));
    reader.readAsDataURL(file);
  });
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function logoPreview(slug: string): string | null {
  const logo = bundledLogos.find((item) => item.slug === slug);
  return logo?.svg ? svgDataUrl(logo.svg) : logo?.asset_urls.png ?? logo?.asset_urls.webp ?? null;
}

function variationPreview(slug: string, variationId: string): string | null {
  const variation = bundledLogos.find((item) => item.slug === slug)?.variations.find((item) => item.id === variationId);
  return variation?.svg ? svgDataUrl(variation.svg) : variation?.asset_urls.png ?? variation?.asset_urls.webp ?? null;
}

function UploadField({ file, onFile }: { file: File | null; onFile: (file: File | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState("");
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <label className={`admin-upload${preview ? " has-file" : ""}`}>
      <input
        type="file"
        accept="image/svg+xml,.svg"
        required
        onChange={(event) => {
          const next = event.target.files?.[0] ?? null;
          if (next && next.size > 1_000_000) {
            setFileError("SVG must be smaller than 1 MB");
            onFile(null);
            event.target.value = "";
            return;
          }
          if (next && !next.name.toLowerCase().endsWith(".svg")) {
            setFileError("Only SVG files are accepted");
            onFile(null);
            event.target.value = "";
            return;
          }
          setFileError("");
          onFile(next);
        }}
      />
      {preview ? <img src={preview} alt="Selected logo preview" /> : <Upload aria-hidden="true" size={22} />}
      <span>{file ? file.name : "Choose SVG"}</span>
      <small className={fileError ? "upload-error" : ""}>{fileError || (file ? `${Math.ceil(file.size / 1024)} KB` : "SVG, maximum 1 MB")}</small>
    </label>
  );
}

export function AdminApp() {
  const [auth, setAuth] = useState<"loading" | "signed-out" | "signed-in">("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [mode, setMode] = useState<"manage" | "add">("manage");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MutationResult | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "awalogo Admin | Nigerian Bank Logos";
    return () => { document.title = previousTitle; };
  }, []);

  async function loadCatalog() {
    const next = await api<CatalogResponse>("/api/admin/catalog");
    if (!Array.isArray(next.catalog) || !next.variations) throw new Error("The catalog API returned an invalid response");
    setData(next);
    setSelectedSlug((current) => current || next.catalog[0]?.slug || "");
  }

  useEffect(() => {
    api<{ user: Session }>("/api/auth/session")
      .then(async ({ user }) => {
        setSession(user);
        setAuth("signed-in");
        await loadCatalog();
      })
      .catch(() => setAuth("signed-out"));
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return (data?.catalog ?? []).filter((logo) => !normalized || `${logo.name} ${logo.slug}`.toLowerCase().includes(normalized));
  }, [data, query]);
  const selected = (data?.catalog ?? []).find((logo) => logo.slug === selectedSlug) ?? null;
  const selectedVariations = selected ? data?.variations[selected.slug] ?? [] : [];

  async function mutate(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const next = await api<MutationResult>("/api/admin/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      setResult(next);
      await loadCatalog();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The request failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  if (auth === "loading") {
    return <main className="admin-state"><LoaderCircle className="spin" aria-hidden="true" /><span>Checking session</span></main>;
  }

  if (auth === "signed-out") {
    const reason = new URLSearchParams(window.location.search).get("error");
    return (
      <main className="admin-login">
        <a className="admin-back" href="/"><ArrowLeft size={16} /> Back to library</a>
        <section>
          <div className="admin-login-mark"><ShieldCheck size={25} /></div>
          <p className="admin-kicker">Restricted workspace</p>
          <h1>Logo catalog admin</h1>
          <p>Sign in with an approved maintainer account.</p>
          {reason ? <div className="admin-alert error">This GitHub account is not authorized.</div> : null}
          <a className="admin-github-button" href="/api/auth/github"><GitFork size={18} /> Continue with GitHub</a>
        </section>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <a className="admin-brand" href="/"><span>NG</span><div><strong>Logo Admin</strong><small>Repository CMS</small></div></a>
        <div className="admin-account">
          <img src={session?.avatarUrl} alt="" />
          <span>@{session?.login}</span>
          <button type="button" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Admin sections">
        <button className={mode === "manage" ? "active" : ""} onClick={() => setMode("manage")}><FileCode2 size={16} /> Manage logos</button>
        <button className={mode === "add" ? "active" : ""} onClick={() => setMode("add")}><Plus size={16} /> Add logo</button>
        <span>{data?.catalog.length ?? 0} managed entries</span>
      </nav>

      {error || result ? (
        <div className={`admin-banner${error ? " error" : " success"}`}>
          {error ? <><X size={17} /><span>{error}</span></> : <><Check size={17} /><span>Pull request #{result?.pullRequest.number} created</span><a href={result?.pullRequest.url} target="_blank" rel="noreferrer">Review PR <ExternalLink size={14} /></a></>}
          <button type="button" aria-label="Dismiss" onClick={() => { setError(""); setResult(null); }}><X size={15} /></button>
        </div>
      ) : null}

      {mode === "add" ? <AddLogoForm busy={busy} onSubmit={mutate} /> : (
        <main className="admin-workspace">
          <aside className="admin-catalog">
            <label className="admin-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search catalog" /></label>
            <div className="admin-logo-list">
              {filtered.map((logo) => (
                <button key={logo.slug} className={logo.slug === selectedSlug ? "active" : ""} onClick={() => setSelectedSlug(logo.slug)}>
                  <span className="admin-list-preview">{logoPreview(logo.slug) ? <img src={logoPreview(logo.slug)!} alt="" /> : <ImagePlus size={16} />}</span>
                  <span><strong>{logo.name}</strong><small>{logo.category.replaceAll("-", " ")}</small></span>
                  <b>{(data?.variations[logo.slug] ?? []).length}</b>
                </button>
              ))}
            </div>
          </aside>
          {selected ? (
            <section className="admin-detail">
              <div className="admin-detail-heading">
                <div><p className="admin-kicker">{selected.status}</p><h1>{selected.name}</h1><p>{selected.slug}</p></div>
                <a href={selected.website} target="_blank" rel="noreferrer">Official website <ExternalLink size={14} /></a>
              </div>
              <div className="admin-primary-preview">
                {logoPreview(selected.slug) ? <img src={logoPreview(selected.slug)!} alt={`${selected.name} logo`} /> : <span>Preview available after deployment</span>}
              </div>
              <VariationManager logo={selected} variations={selectedVariations} busy={busy} mutate={mutate} />
              <DangerZone logo={selected} locked={data?.lockedSlugs.includes(selected.slug) ?? false} busy={busy} mutate={mutate} />
            </section>
          ) : <section className="admin-empty">Select a logo</section>}
        </main>
      )}
      {busy ? <div className="admin-busy" role="status"><LoaderCircle className="spin" /><span>Preparing assets and pull request</span></div> : null}
    </div>
  );
}

function AddLogoForm({ busy, onSubmit }: { busy: boolean; onSubmit: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [manualSlug, setManualSlug] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const form = new FormData(event.currentTarget);
    const ok = await onSubmit({
      operation: "add-logo",
      name,
      slug,
      category: form.get("category"),
      aliases: String(form.get("aliases") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      website: form.get("website"),
      sourceUrl: form.get("sourceUrl"),
      sourceType: form.get("sourceType"),
      svgBase64: await fileToBase64(file)
    });
    if (ok) { event.currentTarget.reset(); setName(""); setSlug(""); setFile(null); }
  }

  return (
    <main className="admin-form-page">
      <div className="admin-page-heading"><p className="admin-kicker">New catalog entry</p><h1>Add a logo</h1></div>
      <form className="admin-form-grid" onSubmit={submit}>
        <section className="admin-form-section">
          <h2>Institution</h2>
          <div className="admin-fields two">
            <label><span>Name</span><input required value={name} onChange={(event) => { setName(event.target.value); if (!manualSlug) setSlug(slugify(event.target.value)); }} placeholder="Access Bank" /></label>
            <label><span>Slug</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => { setManualSlug(true); setSlug(event.target.value); }} placeholder="access-bank" /></label>
            <label><span>Category</span><select name="category" required>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Aliases</span><input name="aliases" placeholder="Access, Access Bank Plc" /></label>
          </div>
        </section>
        <section className="admin-form-section">
          <h2>Official source</h2>
          <div className="admin-fields two">
            <label><span>Website</span><input name="website" type="url" required placeholder="https://company.com" /></label>
            <label><span>Source URL</span><input name="sourceUrl" type="url" required placeholder="https://company.com/brand" /></label>
            <label><span>Source type</span><select name="sourceType" required>{sourceTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
        </section>
        <section className="admin-form-section asset"><div><h2>Logo asset</h2><p>PNG and WebP derivatives are generated automatically.</p></div><UploadField file={file} onFile={setFile} /></section>
        <div className="admin-submit-row"><span>New entries are submitted as needs-review.</span><button disabled={busy || !file} type="submit"><GitFork size={17} /> Create pull request</button></div>
      </form>
    </main>
  );
}

function VariationManager({ logo, variations, busy, mutate }: { logo: Logo; variations: Variation[]; busy: boolean; mutate: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [adding, setAdding] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [variationId, setVariationId] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const form = new FormData(event.currentTarget);
    const ok = await mutate({ operation: "add-variation", slug: logo.slug, variationId, name, sourceUrl: form.get("sourceUrl"), svgBase64: await fileToBase64(file) });
    if (ok) { setAdding(false); setFile(null); setName(""); setVariationId(""); }
  }

  return (
    <section className="admin-variations">
      <div className="admin-section-heading"><div><h2>Variations</h2><p>{variations.length} additional asset{variations.length === 1 ? "" : "s"}</p></div><button onClick={() => setAdding(true)}><Plus size={16} /> Add variation</button></div>
      {variations.length ? <div className="admin-variation-grid">{variations.map((variation) => (
        <article key={variation.id}>
          <div>{variationPreview(logo.slug, variation.id) ? <img src={variationPreview(logo.slug, variation.id)!} alt="" /> : <ImagePlus size={20} />}</div>
          <span><strong>{variation.name}</strong><small>{variation.id}</small></span>
          <button aria-label={`Remove ${variation.name}`} title="Remove variation" onClick={() => { setConfirming(variation.id); setConfirmation(""); }}><Trash2 size={16} /></button>
        </article>
      ))}</div> : <div className="admin-inline-empty"><ImagePlus size={18} /> No variations added</div>}

      {adding ? <div className="admin-dialog-backdrop"><form className="admin-dialog" onSubmit={add}>
        <button className="admin-dialog-close" type="button" onClick={() => setAdding(false)} aria-label="Close"><X size={18} /></button>
        <p className="admin-kicker">{logo.name}</p><h2>Add variation</h2>
        <div className="admin-fields"><label><span>Name</span><input required value={name} onChange={(event) => { setName(event.target.value); setVariationId(slugify(event.target.value)); }} placeholder="Light wordmark" /></label><label><span>Variation ID</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={variationId} onChange={(event) => setVariationId(event.target.value)} /></label><label><span>Official source URL</span><input required name="sourceUrl" type="url" placeholder="https://company.com/brand" /></label></div>
        <UploadField file={file} onFile={setFile} />
        <button className="admin-primary-button" disabled={busy || !file} type="submit"><GitFork size={17} /> Create pull request</button>
      </form></div> : null}

      {confirming ? <ConfirmDialog title="Remove variation" token={confirming} value={confirmation} onChange={setConfirmation} busy={busy} onCancel={() => setConfirming(null)} onConfirm={async () => { const ok = await mutate({ operation: "remove-variation", slug: logo.slug, variationId: confirming, confirmation }); if (ok) setConfirming(null); }} /> : null}
    </section>
  );
}

function DangerZone({ logo, locked, busy, mutate }: { logo: Logo; locked: boolean; busy: boolean; mutate: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  return <section className="admin-danger"><div><h2>Remove logo</h2><p>{locked ? "This core entry is managed in code." : "Removes the logo, variations and unshared asset files."}</p></div><button disabled={locked} onClick={() => setOpen(true)}><Trash2 size={16} /> Remove</button>{open ? <ConfirmDialog title="Remove catalog entry" token={logo.slug} value={confirmation} onChange={setConfirmation} busy={busy} onCancel={() => setOpen(false)} onConfirm={async () => { const ok = await mutate({ operation: "remove-logo", slug: logo.slug, confirmation }); if (ok) setOpen(false); }} /> : null}</section>;
}

function ConfirmDialog({ title, token, value, onChange, busy, onCancel, onConfirm }: { title: string; token: string; value: string; onChange: (value: string) => void; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="admin-dialog-backdrop"><div className="admin-dialog confirm"><div className="admin-danger-icon"><Trash2 size={19} /></div><h2>{title}</h2><p>Type <strong>{token}</strong> to confirm.</p><label><span>Confirmation</span><input autoFocus value={value} onChange={(event) => onChange(event.target.value)} /></label><div className="admin-dialog-actions"><button onClick={onCancel}>Cancel</button><button className="danger" disabled={busy || value !== token} onClick={onConfirm}>Remove in pull request</button></div></div></div>;
}

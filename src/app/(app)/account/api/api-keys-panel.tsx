"use client";

import { useEffect, useState } from "react";

type Scope =
  | "spaces:read"
  | "observations:read"
  | "observations:write"
  | "signals:read";

interface ApiKeyView {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: Scope[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

const SCOPE_OPTIONS: { id: Scope; label: string; description: string }[] = [
  {
    id: "spaces:read",
    label: "Read spaces",
    description: "List spaces this account can access.",
  },
  {
    id: "observations:read",
    label: "Read observations",
    description: "Read approved observations in accessible spaces.",
  },
  {
    id: "observations:write",
    label: "Create observations",
    description: "Add an observation through the normal Swells pipeline.",
  },
  {
    id: "signals:read",
    label: "Read signals",
    description: "Read active signals in accessible spaces.",
  },
];

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKeyView[]>([]);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Scope[]>(
    SCOPE_OPTIONS.map((scope) => scope.id),
  );
  const [expiresInDays, setExpiresInDays] = useState<string>("90");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadKeys() {
    const response = await fetch("/api/account/api-keys", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load API keys");
    const payload = await response.json();
    setKeys(payload.data ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/api-keys", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load API keys");
        return response.json();
      })
      .then((payload) => {
        if (!cancelled) setKeys(payload.data ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load API keys",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function toggleScope(scope: Scope) {
    setScopes((current) =>
      current.includes(scope)
        ? current.filter((item) => item !== scope)
        : [...current, scope],
    );
  }

  async function createKey() {
    if (!name.trim() || scopes.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    setCreatedToken(null);

    try {
      const response = await fetch("/api/account/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          scopes,
          expiresInDays:
            expiresInDays === "never" ? null : Number(expiresInDays),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not create API key");
      }

      setCreatedToken(payload.data.token);
      setName("");
      await loadKeys();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create API key",
      );
    } finally {
      setSaving(false);
    }
  }

  async function revokeKey(id: string) {
    if (
      !window.confirm(
        "Revoke this API key? Anything using it will stop working immediately.",
      )
    ) {
      return;
    }

    setError(null);
    const response = await fetch("/api/account/api-keys/" + id, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "Could not revoke API key");
      return;
    }

    await loadKeys();
  }

  async function copyToken() {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mt-8 space-y-6">
      {createdToken && (
        <section className="rounded-2xl border border-cool-1/25 bg-cool-1/5 p-5">
          <h2 className="text-[0.9rem] font-medium text-cool-1">
            Copy this key now
          </h2>
          <p className="mt-1 text-[0.78rem] leading-relaxed text-text-secondary">
            Swells stores only a hash. This full key will not be shown again.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-deep/60 px-4 py-3 text-[0.78rem] text-text-primary">
              {createdToken}
            </code>
            <button
              onClick={copyToken}
              className="rounded-xl bg-cool-1/15 px-4 py-2.5 text-[0.8rem] font-medium text-cool-1 hover:bg-cool-1/25"
            >
              {copied ? "Copied" : "Copy key"}
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-white/[0.06] bg-surface p-5 md:p-6">
        <h2 className="font-display text-2xl font-light text-text-primary">
          Create a key
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px]">
          <div>
            <label
              htmlFor="api-key-name"
              className="mb-1 block text-[0.75rem] text-text-muted"
            >
              Name
            </label>
            <input
              id="api-key-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Local attention agent"
              maxLength={80}
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[0.85rem] text-text-primary outline-none focus:border-cool-1/30"
            />
          </div>

          <div>
            <label
              htmlFor="api-key-expiry"
              className="mb-1 block text-[0.75rem] text-text-muted"
            >
              Expires
            </label>
            <select
              id="api-key-expiry"
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(event.target.value)}
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[0.85rem] text-text-primary outline-none"
            >
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="never">Never</option>
            </select>
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="text-[0.75rem] text-text-muted">Scopes</legend>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {SCOPE_OPTIONS.map((scope) => (
              <label
                key={scope.id}
                className="flex cursor-pointer gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3"
              >
                <input
                  type="checkbox"
                  checked={scopes.includes(scope.id)}
                  onChange={() => toggleScope(scope.id)}
                  className="mt-1 h-4 w-4 accent-cool-1"
                />
                <span>
                  <span className="block text-[0.82rem] font-medium text-text-primary">
                    {scope.label}
                  </span>
                  <span className="mt-0.5 block text-[0.72rem] leading-relaxed text-text-muted">
                    {scope.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p className="mt-4 text-[0.78rem] text-warm-1">{error}</p>
        )}

        <button
          onClick={createKey}
          disabled={saving || !name.trim() || scopes.length === 0}
          className="mt-5 rounded-xl bg-cool-1/15 px-5 py-2.5 text-[0.82rem] font-medium text-cool-1 transition-colors hover:bg-cool-1/25 disabled:opacity-40"
        >
          {saving ? "Creating…" : "Create API key"}
        </button>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-surface p-5 md:p-6">
        <h2 className="font-display text-2xl font-light text-text-primary">
          Your keys
        </h2>
        <p className="mt-1 text-[0.75rem] text-text-muted">
          Up to 10 active keys per account.
        </p>

        <div className="mt-4 space-y-2">
          {loading ? (
            <p className="py-5 text-[0.8rem] text-text-muted">Loading keys…</p>
          ) : keys.length === 0 ? (
            <p className="py-5 text-[0.8rem] text-text-muted">
              No API keys yet.
            </p>
          ) : (
            keys.map((key) => {
              const inactive =
                !!key.revokedAt ||
                (!!key.expiresAt && new Date(key.expiresAt) <= new Date());

              return (
                <div
                  key={key.id}
                  className={
                    "rounded-xl border border-white/[0.05] p-4 " +
                    (inactive ? "opacity-55" : "")
                  }
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[0.85rem] font-medium text-text-primary">
                          {key.name}
                        </span>
                        <code className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[0.68rem] text-text-muted">
                          {key.keyPrefix}…
                        </code>
                        {inactive && (
                          <span className="text-[0.68rem] text-warm-1">
                            {key.revokedAt ? "Revoked" : "Expired"}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[0.7rem] text-text-muted">
                        Created {formatDate(key.createdAt)} · Last used{" "}
                        {formatDate(key.lastUsedAt)} · Expires{" "}
                        {formatDate(key.expiresAt)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {key.scopes.map((scope) => (
                          <code
                            key={scope}
                            className="rounded-md bg-white/[0.04] px-2 py-1 text-[0.66rem] text-text-secondary"
                          >
                            {scope}
                          </code>
                        ))}
                      </div>
                    </div>

                    {!inactive && (
                      <button
                        onClick={() => revokeKey(key.id)}
                        className="shrink-0 text-[0.75rem] text-warm-1 hover:text-warm-1/80"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-surface p-5 md:p-6">
        <h2 className="font-display text-2xl font-light text-text-primary">
          API v1
        </h2>
        <p className="mt-2 text-[0.8rem] leading-relaxed text-text-secondary">
          Send the key as a Bearer token. Reads are limited to spaces your
          Swells account can access; writes also pass the normal role,
          subscription and monthly observation checks.
        </p>

        <div className="mt-4 space-y-2 font-mono text-[0.74rem] text-text-secondary">
          <div>
            <span className="text-cool-1">GET</span> /api/v1/spaces
          </div>
          <div>
            <span className="text-cool-1">GET</span>{" "}
            /api/v1/observations?spaceId=…
          </div>
          <div>
            <span className="text-warm-3">POST</span> /api/v1/observations
          </div>
          <div>
            <span className="text-cool-1">GET</span>{" "}
            /api/v1/signals?spaceId=…
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/[0.05] bg-deep/60 p-4 font-mono text-[0.72rem] text-text-secondary">
          Authorization: Bearer swl_v1_…
        </div>

        <a
          href="https://docs.swells.app/api-v1/"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block text-[0.78rem] text-cool-1 hover:underline"
        >
          Full API reference ↗
        </a>
      </section>
    </div>
  );
}

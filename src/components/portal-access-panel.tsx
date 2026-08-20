"use client";

import { useCallback, useEffect, useState } from "react";

type TokenRow = {
  id: string;
  label: string | null;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  active: boolean;
};

/**
 * Analyst/ops control to issue/revoke client portal links.
 * Additive panel — does not change correspondent/financial UX.
 */
export function PortalAccessPanel({ processId }: { processId: string }) {
  const [items, setItems] = useState<TokenRow[]>([]);
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/v1/processes/${processId}/portal-access`);
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message ?? "Erro ao listar acessos");
      return;
    }
    setItems(json.data.items);
  }, [processId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function issue() {
    setBusy(true);
    setError(null);
    setIssuedUrl(null);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/portal-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInHours: 72, revokePrevious: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha ao gerar link");
        return;
      }
      const absolute =
        typeof window !== "undefined"
          ? `${window.location.origin}${json.data.path}`
          : json.data.path;
      setIssuedUrl(absolute);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(tokenId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/v1/processes/${processId}/portal-access/${tokenId}/revoke`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha ao revogar");
        return;
      }
      setIssuedUrl(null);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-xl">Acesso do cliente</h2>
      <p className="mt-1 text-sm text-slate-600">
        Gera link seguro `/portal/:token` — token bruto só aparece uma vez.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() => void issue()}
        className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {busy ? "…" : "Gerar link do cliente"}
      </button>

      {issuedUrl ? (
        <div className="mt-3 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm">
          <p className="font-medium text-teal-900">Link (copie agora)</p>
          <p className="mt-1 break-all font-mono text-xs text-teal-800">
            {issuedUrl}
          </p>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}

      {items.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm">
          {items.slice(0, 5).map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2"
            >
              <span>
                {item.active ? (
                  <span className="text-teal-700">Ativo</span>
                ) : item.revokedAt ? (
                  <span className="text-slate-500">Revogado</span>
                ) : (
                  <span className="text-amber-700">Expirado</span>
                )}
                {" · "}
                expira {new Date(item.expiresAt).toLocaleString("pt-BR")}
              </span>
              {item.active ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void revoke(item.id)}
                  className="text-xs text-red-700 hover:underline"
                >
                  Revogar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

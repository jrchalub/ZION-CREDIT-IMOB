"use client";

import { useEffect, useState } from "react";

export function TenantSettingsForm() {
  const [caixaSdkEnabled, setCaixaSdkEnabled] = useState(false);
  const [envCaixaSdkEnabled, setEnvCaixaSdkEnabled] = useState(false);
  const [credentials, setCredentials] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/v1/settings");
      const json = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(json?.error?.message ?? "Erro ao carregar configurações");
        return;
      }
      setCaixaSdkEnabled(Boolean(json.data.caixaSdkEnabled));
      setEnvCaixaSdkEnabled(Boolean(json.data.envCaixaSdkEnabled));
      setCredentials(Boolean(json.data.caixaCredentialsConfigured));
    })();
  }, []);

  async function save() {
    setError(null);
    setSaved(false);
    const res = await fetch("/api/v1/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caixaSdkEnabled }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message ?? "Erro ao salvar");
      return;
    }
    setSaved(true);
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Carregando…</p>;
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="font-serif text-xl">Envio institucional (FASE 7.1)</h2>
        <p className="mt-1 text-sm text-slate-600">
          O SDK Caixa é opcional. Mesmo ligado aqui, cada cliente escolhe no
          processo se envia à Caixa, a outro banco, ou se não envia.
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={caixaSdkEnabled}
          onChange={(e) => {
            setCaixaSdkEnabled(e.target.checked);
            setSaved(false);
          }}
        />
        <span>
          <span className="font-medium">Habilitar canal Caixa neste escritório</span>
          <span className="mt-1 block text-slate-500">
            Desligado: nenhum processo pode disparar o SDK Caixa. O dossiê e o
            encaminhamento a outro banco continuam disponíveis.
          </span>
        </span>
      </label>

      <ul className="space-y-1 text-xs text-slate-500">
        <li>
          Ambiente SDK: {envCaixaSdkEnabled ? "ligado" : "desligado"}{" "}
          (CAIXA_SDK_ENABLED)
        </li>
        <li>
          Credenciais API: {credentials ? "configuradas" : "ausentes"}
        </li>
      </ul>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {saved ? (
        <p className="text-sm text-teal-800">Preferência salva.</p>
      ) : null}

      <button
        type="button"
        onClick={() => void save()}
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Salvar
      </button>
    </div>
  );
}

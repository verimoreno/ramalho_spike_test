"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { API } from "@/lib/api";

function IconExcel() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="16" y2="17"/>
      <line x1="10" y1="9" x2="10" y2="9"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = useCallback((f: File) => {
    if (f.name.match(/\.(xlsx|xls)$/i)) {
      setFile(f);
      setError("");
    } else {
      setError("Por favor selecione um ficheiro Excel (.xlsx ou .xls)");
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !companyName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("company_name", companyName.trim());
      const res = await fetch(`${API}/api/run`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const { run_id } = await res.json();
      router.push(`/run/${run_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar análise. Verifique que o servidor está em execução.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar />

      <main className="flex-1 flex flex-col">
        {/* Top bar */}
        <div
          className="px-8 py-4 flex items-center gap-2 text-xs"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg-subtle)" }}
        >
          <a href="/" style={{ color: "var(--fg-subtle)", textDecoration: "none" }}>Dashboard</a>
          <span>›</span>
          <span style={{ color: "var(--fg)" }}>Nova Análise</span>
        </div>

        <div className="flex-1 px-8 py-8 max-w-2xl w-full mx-auto">
          {/* Header */}
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--fg-subtle)" }}>
              Nova análise PRCE
            </p>
            <h1 className="serif text-4xl font-normal" style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}>
              Carregar ficheiro de frota
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>
              Suportamos qualquer formato Excel de software de gestão de frota. A IA interpreta a estrutura automaticamente.
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-6">
            {/* Drop zone */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--fg)" }}>
                Ficheiro Excel da frota
              </label>
              <div
                className={`dropzone ${dragActive ? "active" : ""} ${file ? "has-file" : ""} flex flex-col items-center justify-center gap-4 py-12 px-6 text-center`}
                onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={onInputChange}
                />

                {file ? (
                  <>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "var(--status-success-bg)", color: "var(--status-success)" }}>
                      <IconCheck />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{file.name}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--fg-subtle)" }}>
                        {(file.size / 1024).toFixed(0)} KB · Clique para substituir
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "var(--surface-sunken)", color: "var(--fg-muted)" }}>
                      <IconUpload />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>
                        Arraste o ficheiro Excel aqui
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--fg-subtle)" }}>
                        ou clique para selecionar · .xlsx, .xls
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Company name */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--fg)" }}>
                Nome do cliente / empresa
              </label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="ex: Cliente 3 — Gestão de Resíduos"
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-strong)",
                  color: "var(--fg)",
                  fontFamily: "var(--font-sans)",
                }}
                onFocus={e => (e.target.style.boxShadow = "var(--shadow-glow)")}
                onBlur={e => (e.target.style.boxShadow = "none")}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-3 rounded-lg text-sm" style={{ background: "var(--status-danger-bg)", color: "var(--status-danger)", border: "1px solid rgba(220,38,38,0.2)" }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!file || !companyName.trim() || loading}
              className="w-full py-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
              style={{
                background: file && companyName.trim() && !loading ? "var(--fg)" : "rgba(36,36,36,0.15)",
                color: file && companyName.trim() && !loading ? "var(--fg-inverse)" : "var(--fg-subtle)",
                cursor: file && companyName.trim() && !loading ? "pointer" : "not-allowed",
                border: "none",
                fontFamily: "var(--font-sans)",
              }}
            >
              {loading ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="step-icon-pulse">
                    <circle cx="12" cy="12" r="10" opacity="0.3"/>
                    <path d="M12 2a10 10 0 0 1 10 10"/>
                  </svg>
                  A iniciar análise...
                </>
              ) : (
                <>
                  Gerar PRCE
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Pipeline preview */}
          <div className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--fg-subtle)" }}>
              O que acontece a seguir
            </p>
            <div className="flex flex-col gap-2">
              {[
                { n: "1", label: "Extração IA", desc: "ForAudits AI Agent lê o Excel e extrai km, tep e carga por categoria (~20s)" },
                { n: "2", label: "Validação", desc: "Verificações automáticas: truncação, dados parciais, cross-check combustível→tep" },
                { n: "3", label: "Cálculo PRCE", desc: "CEE (gep/TK ou gep/VK), K=90%×CEE, metas 3 anos — Portaria 228/90" },
                { n: "4", label: "Documento + Email", desc: "Word PRCE + email de dados em falta — gerados em paralelo (~20s)" },
              ].map(({ n, label, desc }) => (
                <div key={n} className="flex items-start gap-3 py-2">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5"
                    style={{ background: "rgba(193,183,254,0.2)", color: "#5B46D0" }}
                  >
                    {n}
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>{label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--fg-subtle)" }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

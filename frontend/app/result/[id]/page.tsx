"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { API } from "@/lib/api";

interface Target {
  cee: number;
  energy_tep: number;
}

interface Metrics {
  data_period: string;
  fleet_type: string;
  total_km: number;
  total_energy_tep: number;
  total_cargo_t: number | null;
  total_work_tkm: number | null;
  cee_global: number;
  cee_unit: string;
  K: number;
  annual_reduction: number;
  targets: Record<string, Target>;
  data_quality_notes: string;
  total_co2_tco2: number;
}

interface ResultData {
  metrics: Metrics;
  validation: { warnings: string[]; errors: string[] };
  metrics_issues: string[];
  report: {
    gap_summary: string;
    missing_items: string[];
    client_email_pt: string;
  };
  company_name: string;
}

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("pt-PT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCee(n: number, unit: string): string {
  const d = unit === "gep/TK" ? 5 : 2;
  return n.toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function BigMetric({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--fg-subtle)" }}>{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="serif text-3xl font-normal" style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}>{value}</span>
        {unit && <span className="text-xs font-mono" style={{ color: "var(--fg-subtle)" }}>{unit}</span>}
      </div>
      {sub && <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>{sub}</p>}
    </div>
  );
}

function downloadDocx(id: string) {
  window.location.href = `${API}/api/download/${id}`;
}

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"targets" | "email">("targets");

  useEffect(() => {
    if (!id) return;
    fetch(`${API}/api/result/${id}`)
      .then(r => {
        if (!r.ok) throw new Error(`Status ${r.status}`);
        return r.json();
      })
      .then((d: ResultData) => { setData(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center">
          <div className="w-10 h-10 rounded-full mx-auto mb-4 step-icon-pulse" style={{ background: "rgba(193,183,254,0.2)" }} />
          <p className="text-sm" style={{ color: "var(--fg-muted)" }}>A carregar resultados...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <p className="text-sm font-semibold mb-2" style={{ color: "var(--status-danger)" }}>Erro ao carregar resultado</p>
            <p className="text-xs mb-4" style={{ color: "var(--fg-subtle)" }}>{error}</p>
            <a href="/upload" className="text-sm font-medium" style={{ color: "var(--fg)", textDecoration: "underline" }}>
              Nova análise
            </a>
          </div>
        </main>
      </div>
    );
  }

  const { metrics, validation, metrics_issues, report, company_name } = data;
  const hasWarnings = validation.warnings.length > 0 || metrics_issues.length > 0;
  const hasErrors = validation.errors.length > 0;
  const isPartial = (metrics.data_quality_notes || "").toUpperCase().includes("PARCIAL") ||
    (metrics.data_period || "").toUpperCase().includes("Q");

  const targetEntries = Object.entries(metrics.targets);
  const refEntry = targetEntries.find(([k]) => k.includes("ref."));
  const planEntries = targetEntries.filter(([k]) => !k.includes("ref."));

  const refCee = refEntry?.[1].cee ?? metrics.cee_global;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar />

      <main className="flex-1 flex flex-col">
        {/* Top bar */}
        <div
          className="px-8 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--fg-subtle)" }}>
            <a href="/" style={{ color: "var(--fg-subtle)", textDecoration: "none" }}>Dashboard</a>
            <span>›</span>
            <span style={{ color: "var(--fg)" }}>Resultado</span>
          </div>
          <button
            onClick={() => downloadDocx(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: "var(--fg)", color: "var(--fg-inverse)", border: "none", cursor: "pointer" }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Descarregar PRCE (.docx)
          </button>
        </div>

        <div className="flex-1 px-8 py-8 max-w-6xl w-full mx-auto">
          {/* Header */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--fg-subtle)" }}>
              PRCE gerado
            </p>
            <h1 className="serif text-4xl font-normal" style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}>
              {company_name}
            </h1>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <span className="text-sm" style={{ color: "var(--fg-muted)" }}>{metrics.data_period}</span>
              <span className="badge badge-lavender">{metrics.fleet_type.replace("_", " ")}</span>
              {isPartial && <span className="badge badge-warn">⚠ Dados parciais</span>}
              {hasErrors && <span className="badge badge-error">Erros de validação</span>}
            </div>
          </div>

          {/* Partial data banner */}
          {isPartial && (
            <div
              className="rounded-lg px-4 py-3 mb-6 text-sm flex items-start gap-3"
              style={{ background: "var(--status-warn-bg)", border: "1px solid var(--status-warn-border)", color: "var(--status-warn)" }}
            >
              <span className="flex-shrink-0 mt-0.5">⚠</span>
              <div>
                <span className="font-semibold">Dados parciais — documento preliminar. </span>
                Para um PRCE definitivo é necessário o ano completo (Jan–Dez). Consulte o relatório de dados em falta abaixo.
              </div>
            </div>
          )}

          {/* Validation issues */}
          {(hasWarnings || hasErrors) && !isPartial && (
            <div className="mb-6 flex flex-col gap-2">
              {[...validation.errors, ...metrics_issues].map((msg, i) => (
                <div key={i} className="rounded-lg px-4 py-2.5 text-sm flex items-start gap-2"
                  style={{ background: "var(--status-danger-bg)", color: "var(--status-danger)" }}>
                  <span>✕</span><span>{msg}</span>
                </div>
              ))}
              {validation.warnings.map((msg, i) => (
                <div key={i} className="rounded-lg px-4 py-2.5 text-sm flex items-start gap-2"
                  style={{ background: "var(--status-warn-bg)", color: "var(--status-warn)" }}>
                  <span>⚠</span><span>{msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* Main 2-col layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left — Metrics */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              {/* CEE card */}
              <div className="card p-6 flex flex-col gap-5">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--fg-subtle)" }}>
                  Consumo Específico de Energia
                </p>
                <BigMetric
                  label="CEE global"
                  value={fmtCee(metrics.cee_global, metrics.cee_unit)}
                  unit={metrics.cee_unit}
                />
                <div className="grid grid-cols-2 gap-4 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <BigMetric label="K (meta mínima)" value={fmtCee(metrics.K, metrics.cee_unit)} unit={metrics.cee_unit} />
                  <BigMetric label="Redução anual" value={fmtCee(metrics.annual_reduction, metrics.cee_unit)} unit={`${metrics.cee_unit}/ano`} />
                </div>
              </div>

              {/* Fleet summary */}
              <div className="card p-5 flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--fg-subtle)" }}>
                  Dados da frota
                </p>
                {[
                  { label: "Quilómetros totais", value: `${fmt(metrics.total_km, 0)} km` },
                  { label: "Energia total", value: `${fmt(metrics.total_energy_tep)} tep` },
                  ...(metrics.total_cargo_t != null
                    ? [{ label: "Carga transportada", value: `${fmt(metrics.total_cargo_t, 0)} t` }]
                    : []),
                  ...(metrics.total_co2_tco2 != null
                    ? [{ label: "CO₂ estimado", value: `${fmt(metrics.total_co2_tco2)} tCO₂` }]
                    : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>{label}</span>
                    <span className="text-xs font-semibold font-mono" style={{ color: "var(--fg)" }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Download button */}
              <button
                onClick={() => downloadDocx(id)}
                className="flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all"
                style={{ background: "var(--fg)", color: "var(--fg-inverse)", border: "none", cursor: "pointer" }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Descarregar PRCE (.docx)
              </button>

              <a
                href="/upload"
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: "transparent", color: "var(--fg-muted)", textDecoration: "none", border: "1px solid var(--border-strong)" }}
              >
                Nova análise
              </a>
            </div>

            {/* Right — Targets + Email */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              {/* Tabs */}
              <div className="flex gap-0 p-1 rounded-lg" style={{ background: "var(--surface-sunken)" }}>
                {[
                  { key: "targets", label: "Metas PRCE" },
                  { key: "email", label: "Email de dados" },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key as "targets" | "email")}
                    className="flex-1 py-2 rounded-md text-sm font-medium transition-all"
                    style={{
                      background: tab === t.key ? "var(--surface)" : "transparent",
                      color: tab === t.key ? "var(--fg)" : "var(--fg-subtle)",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      boxShadow: tab === t.key ? "var(--shadow-sm)" : "none",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Targets table */}
              {tab === "targets" && (
                <div className="card overflow-hidden flex-1">
                  <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                    <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Plano de Racionalização do Consumo de Energia</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--fg-subtle)" }}>
                      Portaria 228/90 — metas obrigatórias de redução de CEE
                    </p>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-sunken)" }}>
                          {["Ano", `CEE (${metrics.cee_unit})`, "Energia (tep)", "Var."].map(h => (
                            <th key={h} className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--fg-subtle)" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {refEntry && (
                          <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(193,183,254,0.04)" }}>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold" style={{ color: "var(--fg)" }}>{refEntry[0]}</span>
                                <span className="badge badge-lavender">referência</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "var(--fg)" }}>{fmtCee(refEntry[1].cee, metrics.cee_unit)}</td>
                            <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "var(--fg)" }}>{fmt(refEntry[1].energy_tep)}</td>
                            <td className="px-5 py-3.5 text-xs" style={{ color: "var(--fg-subtle)" }}>—</td>
                          </tr>
                        )}
                        {planEntries.map(([year, t]) => {
                          const delta = refCee > 0 ? ((t.cee - refCee) / refCee * 100) : 0;
                          return (
                            <tr key={year} style={{ borderBottom: "1px solid var(--border)" }}>
                              <td className="px-5 py-3.5 font-semibold text-sm" style={{ color: "var(--fg)" }}>{year}</td>
                              <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "var(--fg)" }}>{fmtCee(t.cee, metrics.cee_unit)}</td>
                              <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "var(--fg)" }}>{fmt(t.energy_tep)}</td>
                              <td className="px-5 py-3.5">
                                <span className="text-xs font-semibold" style={{ color: delta < 0 ? "var(--status-success)" : "var(--fg-subtle)" }}>
                                  {delta.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Formula note */}
                  <div className="px-5 py-3 flex items-center gap-2" style={{ background: "var(--surface-sunken)" }}>
                    <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                      M = (C−K)/2 × n/3 · K = 0,9×C · Redução anual = (C−K)/6
                    </span>
                  </div>
                </div>
              )}

              {/* Email draft */}
              {tab === "email" && (
                <div className="card flex flex-col flex-1" style={{ minHeight: 400 }}>
                  <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Email de dados em falta</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--fg-subtle)" }}>
                        {report.missing_items.length} documentos identificados · pronto a enviar
                      </p>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(report.client_email_pt)}
                      className="text-xs font-medium px-3 py-1.5 rounded-md transition-all"
                      style={{ background: "var(--surface-sunken)", color: "var(--fg-muted)", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)" }}
                    >
                      Copiar
                    </button>
                  </div>

                  {/* Gap summary */}
                  {report.gap_summary && (
                    <div className="px-5 py-3 text-xs leading-relaxed" style={{ background: "var(--status-warn-bg)", color: "var(--status-warn)", borderBottom: "1px solid var(--status-warn-border)" }}>
                      {report.gap_summary}
                    </div>
                  )}

                  {/* Missing items */}
                  {report.missing_items.length > 0 && (
                    <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--fg-subtle)" }}>
                        Documentos necessários
                      </p>
                      <ul className="flex flex-col gap-1.5">
                        {report.missing_items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--fg-muted)" }}>
                            <span className="flex-shrink-0 mt-0.5" style={{ color: "#5B46D0" }}>•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Email text */}
                  <div className="flex-1 px-5 py-4 overflow-y-auto" style={{ maxHeight: 360 }}>
                    <pre
                      className="text-xs leading-relaxed whitespace-pre-wrap"
                      style={{ color: "var(--fg-muted)", fontFamily: "var(--font-sans)", margin: 0 }}
                    >
                      {report.client_email_pt || "A gerar email..."}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

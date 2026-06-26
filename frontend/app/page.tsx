import Link from "next/link";
import Sidebar from "@/components/Sidebar";

function MetricCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className="card p-5 flex flex-col gap-3"
      style={accent ? { borderColor: "rgba(193,183,254,0.4)", background: "rgba(193,183,254,0.04)" } : {}}
    >
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--fg-subtle)" }}>
        {label}
      </p>
      <p className="serif text-3xl font-normal" style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}>
        {value}
      </p>
      <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
        {sub}
      </p>
    </div>
  );
}

function RecentItem({
  company,
  period,
  status,
  cee,
  time,
}: {
  company: string;
  period: string;
  status: "done" | "partial" | "error";
  cee?: string;
  time: string;
}) {
  const badge =
    status === "done"
      ? { cls: "badge-ok", label: "Concluído" }
      : status === "partial"
      ? { cls: "badge-warn", label: "Dados parciais" }
      : { cls: "badge-error", label: "Incompleto" };

  return (
    <div
      className="flex items-center gap-4 py-3.5 px-5"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--fg)" }}>
          {company}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--fg-subtle)" }}>
          {period}
          {cee && <span className="ml-2 font-mono">CEE {cee}</span>}
        </p>
      </div>
      <span className={`badge ${badge.cls}`}>{badge.label}</span>
      <p className="text-xs flex-shrink-0" style={{ color: "var(--fg-subtle)" }}>
        {time}
      </p>
      <Link
        href="/upload"
        className="text-xs font-medium flex-shrink-0"
        style={{ color: "var(--fg-muted)", textDecoration: "none" }}
      >
        Abrir →
      </Link>
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar />

      <main className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <div
          className="px-8 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--fg-subtle)" }}>
            <span>RGCEST</span>
            <span>·</span>
            <span>Portaria 228/90</span>
          </div>
          <Link
            href="/upload"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: "var(--fg)",
              color: "var(--fg-inverse)",
              textDecoration: "none",
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nova Análise
          </Link>
        </div>

        {/* Page content */}
        <div className="flex-1 px-8 py-8 max-w-6xl w-full mx-auto">
          {/* Heading */}
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--fg-subtle)" }}>
              Dashboard
            </p>
            <h1 className="serif text-4xl font-normal" style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}>
              Bom dia, Ricardo
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>
              Visão geral da operação PRCE — métricas, análises recentes e ações rápidas.
            </p>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard label="Clientes ativos" value="6" sub="2 com dados novos" />
            <MetricCard label="PRCEs gerados" value="18" sub="em 2025" />
            <MetricCard label="Análises este mês" value="4" sub="+1 esta semana" accent />
            <MetricCard label="Tempo médio" value="46s" sub="por análise completa" />
          </div>

          {/* Quick action — prominent */}
          <div
            className="rounded-xl p-6 mb-8 flex items-center justify-between"
            style={{ background: "var(--fg)", color: "var(--fg-inverse)" }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(247,247,247,0.5)" }}>
                Ação rápida
              </p>
              <h2 className="serif text-2xl font-normal" style={{ letterSpacing: "-0.02em" }}>
                Nova análise PRCE
              </h2>
              <p className="text-sm mt-1" style={{ color: "rgba(247,247,247,0.6)" }}>
                Carregue o Excel da frota → IA extrai, calcula e gera o documento em ~46s
              </p>
            </div>
            <Link
              href="/upload"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold flex-shrink-0 transition-all"
              style={{ background: "#C1B7FE", color: "#22021E", textDecoration: "none" }}
            >
              Iniciar
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </Link>
          </div>

          {/* Recent analyses */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Análises recentes</p>
              <span className="badge badge-muted">2025</span>
            </div>

            <RecentItem
              company="Cliente 3 — Gestão de Resíduos"
              period="2024 ano completo · heavy cargo"
              status="partial"
              cee="0,00164 gep/TK"
              time="hoje"
            />
            <RecentItem
              company="Cliente 4 — MCIZ Serviços Urbanos"
              period="Q1 2026 · urban services"
              status="error"
              time="hoje"
            />
            <RecentItem
              company="Transportes Ramalhão Lda."
              period="2024 full year · heavy cargo"
              status="done"
              cee="0,00120 gep/TK"
              time="3 jan"
            />
            <RecentItem
              company="Logística do Norte SA"
              period="2024 full year · mixed logistics"
              status="done"
              cee="0,00098 gep/TK"
              time="18 dez"
            />

            {/* CTA row */}
            <div className="px-5 py-3.5 flex items-center justify-center">
              <Link
                href="/upload"
                className="text-sm font-medium flex items-center gap-1.5"
                style={{ color: "var(--fg-muted)", textDecoration: "none" }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Nova análise PRCE
              </Link>
            </div>
          </div>

          {/* How it works */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[
              { step: "01", title: "Carregue o Excel", body: "Qualquer formato do software de gestão de frota. A IA interpreta a estrutura variável automaticamente." },
              { step: "02", title: "IA extrai e calcula", body: "ForAudits AI Agent extrai os dados de energia, km e carga. O motor calcula CEE conforme Portaria 228/90." },
              { step: "03", title: "PRCE em 46 segundos", body: "Documento Word pronto a entregar e email de dados em falta para enviar ao cliente — tudo gerado em paralelo." },
            ].map(({ step, title, body }) => (
              <div key={step} className="card p-5">
                <p className="text-xs font-semibold mb-3" style={{ color: "#C1B7FE" }}>{step}</p>
                <p className="text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>{title}</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--fg-subtle)" }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

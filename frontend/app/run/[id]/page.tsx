"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { API } from "@/lib/api";

type StepStatus = "pending" | "active" | "done" | "error";

interface Step {
  key: string;
  label: string;
  sublabel: string;
  status: StepStatus;
  duration?: number;
  detail?: string;
  warnings?: string[];
  errors?: string[];
}

const INITIAL_STEPS: Step[] = [
  { key: "extract", label: "Extração IA", sublabel: "ForAudits AI Agent lê o Excel e extrai métricas energéticas", status: "pending" },
  { key: "validate", label: "Validação", sublabel: "Verificações automáticas de qualidade e completude", status: "pending" },
  { key: "calculate", label: "Cálculo PRCE", sublabel: "CEE, K, redução anual e metas 3 anos (Portaria 228/90)", status: "pending" },
  { key: "generate", label: "Documento + Relatório", sublabel: "Word PRCE e email de dados em falta — em paralelo", status: "pending" },
];

const STEP_PROGRESS: Record<string, number> = {
  extract_start: 8,
  extract_done: 30,
  validate_start: 32,
  validate_done: 42,
  calculate_start: 44,
  calculate_done: 58,
  generate_start: 62,
  generate_done: 88,
  complete: 100,
};

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--status-success-bg)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--status-success)" strokeWidth={2.5}>
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(193,183,254,0.2)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B46D0" strokeWidth={2.5} className="step-icon-pulse">
          <circle cx="12" cy="12" r="10" opacity="0.3"/>
          <path d="M12 2a10 10 0 0 1 10 10"/>
        </svg>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--status-danger-bg)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--status-danger)" strokeWidth={2.5}>
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(36,36,36,0.06)" }}>
      <div className="w-2 h-2 rounded-full" style={{ background: "var(--border-strong)" }} />
    </div>
  );
}

export default function RunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [progress, setProgress] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());
  const esRef = useRef<EventSource | null>(null);

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // SSE stream
  useEffect(() => {
    if (!id) return;
    const es = new EventSource(`${API}/api/stream/${id}`);
    esRef.current = es;

    es.onmessage = (e: MessageEvent) => {
      let data: Record<string, unknown>;
      try { data = JSON.parse(e.data as string); }
      catch { return; }

      const event = data.event as string;
      if (event === "heartbeat") return;

      // Update progress
      const p = STEP_PROGRESS[event];
      if (p !== undefined) setProgress(p);

      setSteps(prev => {
        const next = prev.map(s => ({ ...s }));

        if (event === "extract_start") {
          next[0].status = "active";
        } else if (event === "extract_done") {
          next[0].status = "done";
          next[0].duration = data.duration as number;
          next[0].detail = `${data.period as string} · ${data.fleet_type as string}`;
          if (data.notes) next[0].detail += ` · ${(data.notes as string).slice(0, 80)}...`;
        } else if (event === "validate_start") {
          next[1].status = "active";
        } else if (event === "validate_done") {
          next[1].status = "done";
          next[1].warnings = data.warnings as string[];
          next[1].errors = data.errors as string[];
        } else if (event === "calculate_start") {
          next[2].status = "active";
        } else if (event === "calculate_done") {
          next[2].status = "done";
          next[2].detail = `CEE: ${data.cee} ${data.cee_unit}`;
          if ((data.issues as string[])?.length) next[2].errors = data.issues as string[];
        } else if (event === "generate_start") {
          next[3].status = "active";
        } else if (event === "generate_done") {
          next[3].status = "done";
        } else if (event === "complete") {
          setIsActive(false);
          es.close();
          setTimeout(() => router.push(`/result/${id}`), 600);
        } else if (event === "error") {
          setIsActive(false);
          setErrorMsg((data.message as string) || "Erro desconhecido");
          // Mark the active step as error
          const activeIdx = next.findIndex(s => s.status === "active");
          if (activeIdx >= 0) next[activeIdx].status = "error";
          es.close();
        }
        return next;
      });
    };

    es.onerror = () => {
      if (esRef.current?.readyState === EventSource.CLOSED) return;
      setErrorMsg("Ligação ao servidor perdida. Verifique que o servidor está em execução.");
      setIsActive(false);
    };

    return () => es.close();
  }, [id, router]);

  const allDone = steps.every(s => s.status === "done") && progress === 100;

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
            <a href="/upload" style={{ color: "var(--fg-subtle)", textDecoration: "none" }}>Nova Análise</a>
            <span>›</span>
            <span style={{ color: "var(--fg)" }}>A processar</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
              {allDone ? "Concluído" : errorMsg ? "Erro" : `${elapsed}s decorridos`}
            </span>
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: errorMsg ? "var(--status-danger)" : allDone ? "var(--status-success)" : "#C1B7FE", animation: isActive && !errorMsg ? "pulse 1.2s ease infinite" : "none" }}
            />
          </div>
        </div>

        <div className="flex-1 px-8 py-8 max-w-2xl w-full mx-auto">
          {/* Header */}
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--fg-subtle)" }}>
              {allDone ? "Análise concluída" : errorMsg ? "Erro na análise" : "A processar"}
            </p>
            <h1 className="serif text-4xl font-normal" style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}>
              {allDone ? "PRCE gerado com sucesso" : errorMsg ? "Algo correu mal" : "A gerar o seu PRCE..."}
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>
              {allDone
                ? "O documento Word e o relatório de dados estão prontos."
                : errorMsg
                ? errorMsg
                : "A pipeline executa automaticamente — aguarde alguns segundos."}
            </p>
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: "var(--fg-muted)" }}>
                {allDone ? "Concluído" : errorMsg ? "Interrompido" : "Em progresso"}
              </span>
              <span className="text-xs font-semibold" style={{ color: progress > 0 ? "#5B46D0" : "var(--fg-subtle)" }}>
                {Math.round(progress)}%
              </span>
            </div>
            <div className="progress-track" style={{ background: "#EAE3D2" }}>
              <div
                className={`progress-fill ${isActive && !errorMsg && progress < 100 ? "shimmer" : ""}`}
                style={{
                  width: `${progress}%`,
                  background: errorMsg
                    ? "var(--status-danger)"
                    : allDone
                    ? "var(--status-success)"
                    : undefined,
                }}
              />
            </div>
          </div>

          {/* Step log */}
          <div className="card overflow-hidden">
            {steps.map((step, i) => (
              <div
                key={step.key}
                className="flex items-start gap-4 px-5 py-4"
                style={{
                  borderBottom: i < steps.length - 1 ? "1px solid var(--border)" : undefined,
                  opacity: step.status === "pending" ? 0.45 : 1,
                  transition: "opacity 300ms ease",
                }}
              >
                <StepIcon status={step.status} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold" style={{ color: step.status === "pending" ? "var(--fg-subtle)" : "var(--fg)" }}>
                      {step.label}
                    </p>
                    {step.status === "active" && (
                      <span className="badge badge-lavender">em progresso</span>
                    )}
                    {step.duration !== undefined && (
                      <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>{step.duration}s</span>
                    )}
                  </div>

                  <p className="text-xs mt-0.5" style={{ color: "var(--fg-subtle)" }}>
                    {step.status === "pending" ? step.sublabel : step.detail || step.sublabel}
                  </p>

                  {/* Warnings */}
                  {(step.warnings ?? []).map((w, wi) => (
                    <div key={wi} className="mt-2 flex items-start gap-1.5 text-xs" style={{ color: "var(--status-warn)" }}>
                      <span className="flex-shrink-0">⚠</span>
                      <span>{w}</span>
                    </div>
                  ))}

                  {/* Errors / issues */}
                  {(step.errors ?? []).map((err, ei) => (
                    <div key={ei} className="mt-2 flex items-start gap-1.5 text-xs" style={{ color: "var(--status-danger)" }}>
                      <span className="flex-shrink-0">✕</span>
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Error action */}
          {errorMsg && (
            <div className="mt-6 flex gap-3">
              <a
                href="/upload"
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-center transition-all"
                style={{ background: "var(--fg)", color: "var(--fg-inverse)", textDecoration: "none" }}
              >
                Tentar novamente
              </a>
            </div>
          )}

          {/* Tip */}
          {!errorMsg && !allDone && (
            <p className="mt-6 text-xs text-center" style={{ color: "var(--fg-subtle)" }}>
              A extração com IA demora ~20s · O documento e email são gerados em paralelo
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

import React from "react";
import type { AgentInfo, MetricRow } from "../services/api";
import { MetricsCharts } from "./MetricsCharts";

interface AgentDetailProps {
  agent: AgentInfo;
  metrics: MetricRow[];
  onDelete: (id: string) => void;
}

export const AgentDetail: React.FC<AgentDetailProps> = ({ agent, metrics, onDelete }) => {
  const isAgentOnline = (lastSeenAt: number | null): boolean => {
    if (!lastSeenAt) return false;
    return Date.now() - lastSeenAt < 45000;
  };

  const formatLastSeen = (lastSeenAt: number | null) => {
    if (!lastSeenAt) return "Nunca visto";
    const diff = Date.now() - lastSeenAt;
    if (diff < 10000) return "Agora mesmo";
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `Há ${seconds} segundos`;
    const minutes = Math.floor(seconds / 60);
    return `Há ${minutes} min e ${seconds % 60}s`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const online = isAgentOnline(agent.last_seen_at);
  const latestMetric = metrics[0]; // a primeira é a mais recente devido ao LIMIT e ORDER BY received_at DESC no backend

  // Helpers para progresso
  const getProgressColorClass = (pct: number) => {
    if (pct < 60) return "success";
    if (pct < 85) return "primary";
    return "danger";
  };

  return (
    <div className="detail-area">
      {/* Detalhes de Cabeçalho do Agente */}
      <div className="detail-header">
        <div className="detail-title-wrapper">
          <div className="detail-title-row">
            <h2 className="detail-hostname">{agent.hostname}</h2>
            <span className={`status-badge ${online ? "online" : "offline"}`}>
              {online ? "Online" : "Offline"}
            </span>
            <button
              onClick={() => {
                if (window.confirm(`Tem certeza que deseja APAGAR o agente ${agent.hostname} e todo o seu histórico de métricas?`)) {
                  onDelete(agent.id);
                }
              }}
              style={{
                marginLeft: "auto",
                backgroundColor: "var(--danger)",
                color: "white",
                border: "none",
                borderRadius: "0.4rem",
                padding: "0.4rem 0.8rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-family)"
              }}
            >
              🗑️ Apagar
            </button>
          </div>
          <div className="detail-meta-grid">
            <div className="meta-item">
              <span className="meta-label">ID do Agente</span>
              <span className="meta-value code">{agent.id}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Plataforma</span>
              <span className="meta-value" style={{ textTransform: "capitalize" }}>
                {agent.platform}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">IP do Agente</span>
              <span className="meta-value code">{agent.ip || "N/A"}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Último Visto</span>
              <span className="meta-value" title={agent.last_seen_at ? new Date(agent.last_seen_at).toLocaleString() : ""}>
                {formatLastSeen(agent.last_seen_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Métricas e Histórico */}
      <div className="detail-content">
        {latestMetric ? (
          <>
            {/* Grid de Cards de Métricas em Tempo Real */}
            <div className="metrics-summary-grid">
              {/* CPU Widget */}
              <div className="metric-widget">
                <div className="widget-title-row">
                  <span className="widget-title">Uso de CPU</span>
                  <span className="meta-label">Realtime</span>
                </div>
                <div className="widget-value">{latestMetric.cpu_used_pct.toFixed(1)}%</div>
                <div className="progress-bar-wrapper">
                  <div className="progress-bar-track">
                    <div
                      className={`progress-bar-fill ${getProgressColorClass(latestMetric.cpu_used_pct)}`}
                      style={{ width: `${latestMetric.cpu_used_pct}%` }}
                    />
                  </div>
                  <div className="progress-labels">
                    <span>Métrica atual</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              {/* RAM Widget */}
              <div className="metric-widget">
                <div className="widget-title-row">
                  <span className="widget-title">Uso de Memória RAM</span>
                  <span className="meta-label">
                    {formatBytes(latestMetric.mem_used_bytes)} / {formatBytes(latestMetric.mem_total_bytes)}
                  </span>
                </div>
                <div className="widget-value">{latestMetric.mem_used_pct.toFixed(1)}%</div>
                <div className="progress-bar-wrapper">
                  <div className="progress-bar-track">
                    <div
                      className={`progress-bar-fill ${getProgressColorClass(latestMetric.mem_used_pct)}`}
                      style={{ width: `${latestMetric.mem_used_pct}%` }}
                    />
                  </div>
                  <div className="progress-labels">
                    <span>Livre: {formatBytes(latestMetric.mem_free_bytes)}</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              {/* DISCO Widget */}
              <div className="metric-widget">
                <div className="widget-title-row">
                  <span className="widget-title">Espaço em Disco</span>
                  <span className="meta-label">
                    {formatBytes(latestMetric.disk_used_bytes)} / {formatBytes(latestMetric.disk_total_bytes)}
                  </span>
                </div>
                <div className="widget-value">{latestMetric.disk_used_pct.toFixed(1)}%</div>
                <div className="progress-bar-wrapper">
                  <div className="progress-bar-track">
                    <div
                      className={`progress-bar-fill ${getProgressColorClass(latestMetric.disk_used_pct)}`}
                      style={{ width: `${latestMetric.disk_used_pct}%` }}
                    />
                  </div>
                  <div className="progress-labels">
                    <span>Livre: {formatBytes(latestMetric.disk_free_bytes)}</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              {/* Sistema Widget */}
              <div className="metric-widget" style={{ gridColumn: "span 1" }}>
                <div className="widget-title-row">
                  <span className="widget-title">Status do Sistema</span>
                  <span className="meta-label">Geral</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>Processos ativos:</span>
                    <span style={{ fontWeight: 600 }}>{latestMetric.sys_process_count ?? "N/A"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>IP de rede:</span>
                    <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{latestMetric.net_ip ?? "N/A"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>Coleta da métrica:</span>
                    <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>
                      {new Date(latestMetric.collected_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Gráficos de telemetria histórica */}
            <MetricsCharts metrics={metrics} />
          </>
        ) : (
          <div className="placeholder-container" style={{ minHeight: "300px" }}>
            <div className="placeholder-icon">📊</div>
            <p>Nenhuma métrica foi coletada deste agente até o momento.</p>
            <p style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
              Certifique-se de que o daemon do agente está executando e enviando dados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

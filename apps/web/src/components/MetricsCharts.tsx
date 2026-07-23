import React from "react";
import type { MetricRow } from "../services/api";

interface MetricsChartsProps {
  metrics: MetricRow[];
}

export const MetricsCharts: React.FC<MetricsChartsProps> = ({ metrics }) => {
  if (metrics.length === 0) {
    return (
      <div className="charts-panel" style={{ height: "300px", justifyContent: "center", alignItems: "center", color: "var(--text-dim)" }}>
        Aguardando dados de telemetria...
      </div>
    );
  }

  // Clona e inverte para ordem cronológica (antigo para novo)
  const data = [...metrics].reverse();
  const limitPoints = 30; // exibe no máximo as últimas 30 métricas no gráfico para legibilidade
  const chartData = data.slice(-limitPoints);

  const width = 800;
  const height = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 15;
  const paddingBottom = 25;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Mapeia porcentagem para coordenada SVG
  const getCoordinates = (index: number, pct: number) => {
    const totalPoints = chartData.length;
    const x = paddingLeft + (totalPoints > 1 ? (index / (totalPoints - 1)) * chartWidth : 0);
    const y = height - paddingBottom - (pct / 100) * chartHeight;
    return { x, y };
  };

  // Gerar caminhos de linhas para CPU e RAM
  let cpuPath = "";
  let ramPath = "";

  chartData.forEach((d, idx) => {
    const cpuCoord = getCoordinates(idx, d.cpu_used_pct);
    const ramCoord = getCoordinates(idx, d.mem_used_pct);

    if (idx === 0) {
      cpuPath = `M ${cpuCoord.x} ${cpuCoord.y}`;
      ramPath = `M ${ramCoord.x} ${ramCoord.y}`;
    } else {
      cpuPath += ` L ${cpuCoord.x} ${cpuCoord.y}`;
      ramPath += ` L ${ramCoord.x} ${ramCoord.y}`;
    }
  });

  const gridLines = [0, 25, 50, 75, 100];

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
  };

  return (
    <div className="charts-panel">
      <div className="chart-header">
        <h3 className="widget-title">Histórico de Telemetria (Últimas {chartData.length} Coletas)</h3>
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-color cpu" />
            <span style={{ color: "var(--text-main)" }}>CPU</span>
          </div>
          <div className="legend-item">
            <span className="legend-color ram" />
            <span style={{ color: "var(--text-main)" }}>RAM</span>
          </div>
        </div>
      </div>

      <div className="svg-chart-container">
        <svg viewBox={`0 0 ${width} ${height}`} className="svg-chart" width="100%" height="100%">
          {/* Linhas de grade Y */}
          {gridLines.map((val) => {
            const y = height - paddingBottom - (val / 100) * chartHeight;
            return (
              <g key={val}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  className="chart-grid-line"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  className="chart-axis-text chart-axis-text-y"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* Rótulos do eixo X (horários das coletas) */}
          {chartData.length > 0 &&
            [0, Math.floor(chartData.length / 2), chartData.length - 1].map((idx) => {
              if (idx >= chartData.length) return null;
              const item = chartData[idx]!;
              const totalPoints = chartData.length;
              const x = paddingLeft + (totalPoints > 1 ? (idx / (totalPoints - 1)) * chartWidth : 0);
              return (
                <text
                  key={idx}
                  x={x}
                  y={height - 6}
                  className="chart-axis-text"
                  textAnchor={idx === 0 ? "start" : idx === chartData.length - 1 ? "end" : "middle"}
                >
                  {formatTime(item.received_at)}
                </text>
              );
            })}

          {/* Caminhos SVG */}
          {chartData.length > 1 && (
            <>
              <path d={cpuPath} className="chart-line cpu" />
              <path d={ramPath} className="chart-line ram" />
            </>
          )}

          {/* Pontos de destaque da última telemetria coletada */}
          {chartData.length > 0 &&
            (() => {
              const lastIdx = chartData.length - 1;
              const lastCpu = chartData[lastIdx]!.cpu_used_pct;
              const lastRam = chartData[lastIdx]!.mem_used_pct;
              const cpuCoord = getCoordinates(lastIdx, lastCpu);
              const ramCoord = getCoordinates(lastIdx, lastRam);

              return (
                <>
                  <circle cx={cpuCoord.x} cy={cpuCoord.y} r="4" fill="var(--primary)" stroke="var(--bg-surface)" strokeWidth="1" />
                  <circle cx={ramCoord.x} cy={ramCoord.y} r="4" fill="hsl(263, 90%, 66%)" stroke="var(--bg-surface)" strokeWidth="1" />
                </>
              );
            })()}
        </svg>
      </div>
    </div>
  );
};

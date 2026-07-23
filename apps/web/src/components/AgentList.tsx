import React, { useState } from "react";
import type { AgentInfo } from "../services/api";

interface AgentListProps {
  agents: AgentInfo[];
  selectedAgentId: string | null;
  onSelectAgent: (agent: AgentInfo) => void;
}

export const AgentList: React.FC<AgentListProps> = ({
  agents,
  selectedAgentId,
  onSelectAgent,
}) => {
  const [search, setSearch] = useState("");

  const isAgentOnline = (lastSeenAt: number | null): boolean => {
    if (!lastSeenAt) return false;
    // Considera online se visto nos últimos 45 segundos
    return Date.now() - lastSeenAt < 45000;
  };

  const filteredAgents = agents.filter(
    (agent) =>
      agent.hostname.toLowerCase().includes(search.toLowerCase()) ||
      (agent.ip && agent.ip.includes(search))
  );

  return (
    <div className="sidebar">
      <div className="search-box">
        <div className="search-input-wrapper">
          <svg
            className="search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por host ou IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="agent-list">
        {filteredAgents.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-dim)", fontSize: "0.9rem" }}>
            Nenhum agente encontrado
          </div>
        ) : (
          filteredAgents.map((agent) => {
            const online = isAgentOnline(agent.last_seen_at);
            const isSelected = selectedAgentId === agent.id;

            return (
              <div
                key={agent.id}
                className={`agent-card ${isSelected ? "selected" : ""}`}
                onClick={() => onSelectAgent(agent)}
              >
                <div className="agent-card-header">
                  <span className="agent-hostname" title={agent.hostname}>
                    {agent.hostname}
                  </span>
                  <span
                    className={`agent-status-dot ${online ? "online" : "offline"}`}
                    title={online ? "Online" : "Offline"}
                  />
                </div>
                <div className="agent-card-body">
                  <span className="agent-platform">{agent.platform}</span>
                  <span className="agent-ip">{agent.ip || "Sem IP"}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

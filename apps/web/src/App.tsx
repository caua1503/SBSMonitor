import React, { useState, useEffect, useCallback } from "react";
import { api } from "./services/api";
import type { AgentInfo, MetricRow } from "./services/api";
import { isAuthenticated, logout } from "./services/auth";
import { AgentList } from "./components/AgentList";
import { AgentDetail } from "./components/AgentDetail";
import { LoginPage } from "./components/LoginPage";
import { CreateAgentModal } from "./components/CreateAgentModal";

export const App: React.FC = () => {
  const [authed, setAuthed] = useState<boolean>(isAuthenticated());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Logout automático quando token expira durante uma requisição
  useEffect(() => {
    const handler = () => {
      setAuthed(false);
      setAgents([]);
      setSelectedAgent(null);
      setMetrics([]);
    };
    window.addEventListener("auth:expired", handler);
    return () => window.removeEventListener("auth:expired", handler);
  }, []);

  const handleLogout = () => {
    logout();
    setAuthed(false);
    setAgents([]);
    setSelectedAgent(null);
    setMetrics([]);
  };

  const loadAgents = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await api.getAgents();
      setAgents(data);
      setError(null);

      // Atualiza os dados do agente selecionado se ele ainda existir na lista
      if (selectedAgent) {
        const updated = data.find((a) => a.id === selectedAgent.id);
        if (updated) {
          setSelectedAgent(updated);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.message !== "Sessão expirada") {
        setError("Erro ao se conectar ao servidor da API de monitoramento.");
      }
    } finally {
      if (!isSilent) setLoading(false);
      setLastUpdated(new Date());
    }
  }, [selectedAgent]);

  const loadMetrics = useCallback(async (agentId: string, isSilent = false) => {
    try {
      const data = await api.getAgentMetrics(agentId, 50);
      setMetrics(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Carrega a lista de agentes inicial
  useEffect(() => {
    if (!authed) return;
    loadAgents();
  }, [authed]);

  // Carrega métricas e configura loop de refresh para o agente selecionado
  useEffect(() => {
    if (!selectedAgent || !authed) return;

    loadMetrics(selectedAgent.id);

    const timer = setInterval(() => {
      loadMetrics(selectedAgent.id, true);
    }, 10000);

    return () => clearInterval(timer);
  }, [selectedAgent, loadMetrics, authed]);

  // Loop de atualização da lista lateral de agentes
  useEffect(() => {
    if (!authed) return;
    const timer = setInterval(() => {
      loadAgents(true);
    }, 15000);

    return () => clearInterval(timer);
  }, [loadAgents, authed]);

  const handleSelectAgent = (agent: AgentInfo) => {
    setSelectedAgent(agent);
    setMetrics([]); // Limpa as métricas para não piscar dados antigos na tela
  };

  const handleDeleteAgent = async (id: string) => {
    try {
      await api.deleteAgent(id);
      if (selectedAgent?.id === id) {
        setSelectedAgent(null);
        setMetrics([]);
      }
      loadAgents(true);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Erro ao apagar agente");
    }
  };

  if (!authed) {
    return <LoginPage onAuthenticated={() => setAuthed(true)} />;
  }

  return (
    <div className="dashboard-container">
      {/* Top Header */}
      <header className="header">
        <div className="header-brand">
          <div className="logo-icon">S</div>
          <h1 className="logo-text">SBSMonitor</h1>
        </div>
        <div className="header-status">
          <div className="status-indicator">
            <span className="pulse-dot" />
            <span>Sistema Ativo</span>
          </div>
          <span className="last-update">
            Última atualização: {lastUpdated.toLocaleTimeString()}
          </span>
          <button
            id="btn-new-agent"
            className="btn-new-agent"
            onClick={() => setShowCreateModal(true)}
          >
            + Novo Agente
          </button>
          <button id="btn-logout" className="btn-logout" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="main-layout">
        {loading && agents.length === 0 ? (
          <div className="placeholder-container" style={{ flex: 1 }}>
            <div className="spinner" />
            <p>Carregando agentes do sistema...</p>
          </div>
        ) : error ? (
          <div className="placeholder-container" style={{ flex: 1 }}>
            <div className="placeholder-icon" style={{ color: "var(--danger)" }}>⚠️</div>
            <p>{error}</p>
            <button
              onClick={() => loadAgents()}
              style={{
                padding: "0.6rem 1.2rem",
                backgroundColor: "var(--primary)",
                border: "none",
                borderRadius: "0.5rem",
                color: "white",
                cursor: "pointer",
                fontWeight: 600,
                marginTop: "1rem",
                fontFamily: "var(--font-family)",
                boxShadow: "0 0 10px var(--primary-glow)",
              }}
            >
              Tentar Novamente
            </button>
          </div>
        ) : (
          <>
            <AgentList
              agents={agents}
              selectedAgentId={selectedAgent?.id || null}
              onSelectAgent={handleSelectAgent}
            />

            {selectedAgent ? (
              <AgentDetail 
                agent={selectedAgent} 
                metrics={metrics} 
                onDelete={handleDeleteAgent}
              />
            ) : (
              <div className="detail-area placeholder-container">
                <div className="placeholder-icon">🖥️</div>
                <h2>Selecione um Agente Monitorado</h2>
                <p style={{ color: "var(--text-dim)", maxWidth: "450px" }}>
                  Escolha um dos agentes na barra lateral para ver o status detalhado da máquina e telemetria de CPU, Memória RAM e Disco em tempo real.
                </p>
              </div>
            )}
          </>
        )}
      </div>
      {showCreateModal && (
        <CreateAgentModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            loadAgents(true);
          }}
        />
      )}
    </div>
  );
};


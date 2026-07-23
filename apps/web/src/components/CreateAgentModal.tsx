import React, { useState, useRef, useEffect } from "react";
import { api } from "../services/api";
import type { CreatedAgent } from "../services/api";

interface CreateAgentModalProps {
  onClose: () => void;
  onCreated: () => void;
}

type Step = "form" | "credentials";

const PLATFORMS = ["linux", "windows", "darwin", "freebsd", "other"];

export const CreateAgentModal: React.FC<CreateAgentModalProps> = ({
  onClose,
  onCreated,
}) => {
  const [step, setStep] = useState<Step>("form");
  const [hostname, setHostname] = useState("");
  const [platform, setPlatform] = useState("linux");
  const [ip, setIp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CreatedAgent | null>(null);
  const [copied, setCopied] = useState<"id" | "secret" | "all" | null>(null);
  const hostnameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hostnameRef.current?.focus();
  }, []);

  // Fechar com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostname.trim()) {
      setError("Hostname é obrigatório");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.createAgent({
        hostname: hostname.trim(),
        platform,
        ip: ip.trim() || undefined,
      });
      setCredentials(result);
      setStep("credentials");
      onCreated(); // Atualiza a lista de agentes em background
    } catch (err: any) {
      setError(err.message || "Erro ao criar agente");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, key: "id" | "secret" | "all") => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-card" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              {step === "form" ? "Novo Agente" : "Credenciais Geradas"}
            </h2>
            <p className="modal-subtitle">
              {step === "form"
                ? "Registre um novo agente de monitoramento"
                : "Salve as credenciais — o secret não será exibido novamente"}
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        {/* Form step */}
        {step === "form" && (
          <form onSubmit={handleSubmit} className="modal-body">
            <div className="form-group">
              <label className="form-label" htmlFor="agent-hostname">
                Hostname <span className="form-required">*</span>
              </label>
              <input
                id="agent-hostname"
                ref={hostnameRef}
                className="form-input"
                type="text"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="meu-servidor-01"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="agent-platform">
                Plataforma <span className="form-required">*</span>
              </label>
              <select
                id="agent-platform"
                className="form-input form-select"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                disabled={loading}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="agent-ip">
                IP <span className="form-optional">(opcional)</span>
              </label>
              <input
                id="agent-ip"
                className="form-input"
                type="text"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.1.100"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="login-error" role="alert">
                <span className="login-error-icon">⚠</span>
                {error}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                id="btn-create-agent"
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-sm" />
                    Criando...
                  </>
                ) : (
                  "Criar Agente"
                )}
              </button>
            </div>
          </form>
        )}

        {/* Credentials step */}
        {step === "credentials" && credentials && (
          <div className="modal-body">
            <div className="credentials-warning">
              <span className="credentials-warning-icon">⚠</span>
              <p>
                O <strong>secret</strong> é exibido apenas uma vez. Copie e
                armazene com segurança antes de fechar.
              </p>
            </div>

            <div className="credential-item">
              <div className="credential-header">
                <span className="credential-label">Agent ID</span>
                <button
                  className="btn-copy"
                  onClick={() => copyToClipboard(credentials.id, "id")}
                >
                  {copied === "id" ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
              <code className="credential-value">{credentials.id}</code>
            </div>

            <div className="credential-item">
              <div className="credential-header">
                <span className="credential-label">Secret</span>
                <button
                  className="btn-copy"
                  onClick={() => copyToClipboard(credentials.secret, "secret")}
                >
                  {copied === "secret" ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
              <code className="credential-value credential-secret">
                {credentials.secret}
              </code>
            </div>

            <button
              className="btn-copy-all"
              onClick={() =>
                copyToClipboard(
                  `AGENT_ID=${credentials.id}\nAGENT_SECRET=${credentials.secret}`,
                  "all"
                )
              }
            >
              {copied === "all" ? "✓ Copiado!" : "📋 Copiar tudo como .env"}
            </button>

            <div className="modal-actions" style={{ marginTop: "0.5rem" }}>
              <button className="btn-primary" onClick={onClose}>
                Concluído
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

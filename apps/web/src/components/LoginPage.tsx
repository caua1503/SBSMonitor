import React, { useState, useRef, useEffect } from "react";
import { login } from "../services/auth";

interface LoginPageProps {
  onAuthenticated: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onAuthenticated }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Preencha usuário e senha");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
      onAuthenticated();
    } catch (err: any) {
      setError(err.message || "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <div className="logo-icon">S</div>
            <h1 className="logo-text">SBSMonitor</h1>
          </div>
          <p className="login-subtitle">Painel Administrativo</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">
              Usuário
            </label>
            <input
              id="login-username"
              ref={usernameRef}
              className="form-input"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              placeholder="admin"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Senha
            </label>
            <input
              id="login-password"
              className="form-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="login-error" role="alert">
              <span className="login-error-icon">⚠</span>
              {error}
            </div>
          )}

          <button
            id="btn-login"
            className="btn-login"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-sm" />
                Autenticando...
              </>
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        <p className="login-footer">
          Acesso restrito a administradores do sistema.
        </p>
      </div>

      {/* Fundo animado */}
      <div className="login-bg-orb login-bg-orb--blue" />
      <div className="login-bg-orb login-bg-orb--purple" />
    </div>
  );
};

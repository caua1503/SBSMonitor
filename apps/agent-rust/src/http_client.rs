use std::{
    fs::File,
    io::{BufReader, Read, Write},
    net::{SocketAddr, TcpStream, ToSocketAddrs},
    sync::Arc,
    time::Duration,
};

use rustls::{pki_types::ServerName, ClientConfig, ClientConnection, RootCertStore, StreamOwned};
use serde::Serialize;
use ureq::Agent;

use crate::{
    collectors,
    config::Config,
    error::AgentError,
    models::{MetricsPayload, RegisterPayload},
};

/// Envolve a resolução DNS síncrona da std do Rust em uma thread separada para respeitar
/// o `request_timeout` configurado. A std do Rust não disponibiliza timeout nativo para
/// `ToSocketAddrs`, e adotou-se uma thread auxiliar leve em vez de migrar a aplicação para
/// uma biblioteca/runtime assíncrona (como tokio/async-std), preservando o footprint pequeno
/// e a compatibilidade com o Windows XP.
pub fn resolve_socket_addr_with_timeout(
    host: &str,
    port: u16,
    timeout: Duration,
) -> Result<SocketAddr, AgentError> {
    let host_owned = host.to_owned();
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let res = (host_owned.as_str(), port)
            .to_socket_addrs()
            .map_err(AgentError::from)
            .and_then(|mut addrs| {
                addrs
                    .next()
                    .ok_or_else(|| AgentError::Http("host has no address".to_owned()))
            });
        let _ = tx.send(res);
    });

    match rx.recv_timeout(timeout) {
        Ok(result) => result,
        Err(std::sync::mpsc::RecvTimeoutError::Timeout) => Err(AgentError::DnsTimeout),
        Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => Err(AgentError::Http(
            "DNS resolution thread disconnected".to_owned(),
        )),
    }
}

/// HTTPS client that always sends the agent's header credentials.
pub struct HttpClient {
    config: Config,
    public_agent: Option<Agent>,
    custom_tls: Option<Arc<ClientConfig>>,
}

impl HttpClient {
    pub fn new(config: &Config) -> Result<Self, AgentError> {
        let custom_tls = match &config.ca_cert_path {
            Some(path) => Some(Arc::new(load_tls_config(path)?)),
            None => None,
        };
        let public_agent = if custom_tls.is_none() {
            Some(
                Agent::config_builder()
                    .timeout_global(Some(config.request_timeout))
                    .build()
                    .new_agent(),
            )
        } else {
            None
        };
        Ok(Self {
            config: config.clone(),
            public_agent,
            custom_tls,
        })
    }

    pub fn register(&self) -> Result<(), AgentError> {
        let payload = RegisterPayload {
            hostname: collectors::hostname()?,
            platform: "win32",
            ip: collectors::collect_primary_ipv4().ip,
        };
        self.post_json("/api/v1/agents/register", &payload)
    }

    pub fn send_metrics(&self, metrics: &MetricsPayload) -> Result<(), AgentError> {
        self.post_json("/api/v1/agents/metrics", metrics)
    }

    fn post_json(&self, path: &str, payload: &impl Serialize) -> Result<(), AgentError> {
        let url = format!("{}{path}", self.config.server_url);
        if let Some(agent) = &self.public_agent {
            let response = agent
                .post(&url)
                .header("X-Agent-ID", &self.config.agent_id)
                .header("X-Agent-Secret", &self.config.agent_secret)
                .send_json(payload)
                .map_err(map_ureq_error)?;
            if !(200..300).contains(&response.status().as_u16()) {
                return Err(AgentError::HttpStatus(response.status().as_u16()));
            }
            return Ok(());
        }
        self.post_with_custom_ca(&url, payload)
    }

    /// Uses a custom Rustls root store only when an internal CA is configured. Rustls lets us
    /// append that CA to WebPKI roots without delegating certificate verification to Schannel.
    fn post_with_custom_ca(&self, url: &str, payload: &impl Serialize) -> Result<(), AgentError> {
        let parsed = url::Url::parse(url).map_err(|error| AgentError::Http(error.to_string()))?;
        let host = parsed
            .host_str()
            .ok_or_else(|| AgentError::Http("URL has no host".to_owned()))?;
        let port = parsed
            .port_or_known_default()
            .ok_or_else(|| AgentError::Http("URL has no port".to_owned()))?;
        let socket = resolve_socket_addr_with_timeout(host, port, self.config.request_timeout)?;
        let stream = TcpStream::connect_timeout(&socket, self.config.request_timeout)?;
        stream.set_read_timeout(Some(self.config.request_timeout))?;
        stream.set_write_timeout(Some(self.config.request_timeout))?;
        let server_name = ServerName::try_from(host.to_owned())
            .map_err(|error| AgentError::Http(error.to_string()))?;
        let connection = ClientConnection::new(
            self.custom_tls.as_ref().expect("custom TLS exists").clone(),
            server_name,
        )
        .map_err(|error| AgentError::Http(error.to_string()))?;
        let mut tls = StreamOwned::new(connection, stream);
        let body = serde_json::to_vec(payload)?;
        let target = if parsed.path().is_empty() {
            "/"
        } else {
            parsed.path()
        };
        let target = match parsed.query() {
            Some(query) => format!("{target}?{query}"),
            None => target.to_owned(),
        };
        write!(tls, "POST {target} HTTP/1.1\r\nHost: {host}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nX-Agent-ID: {}\r\nX-Agent-Secret: {}\r\nConnection: close\r\n\r\n", body.len(), self.config.agent_id, self.config.agent_secret)?;
        tls.write_all(&body)?;
        tls.flush()?;
        let mut response = Vec::new();
        tls.read_to_end(&mut response)?;
        let status = parse_status(&response)?;
        if !(200..300).contains(&status) {
            return Err(AgentError::HttpStatus(status));
        }
        Ok(())
    }
}

fn load_tls_config(path: &std::path::Path) -> Result<ClientConfig, AgentError> {
    let mut roots = RootCertStore::empty();
    roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
    let mut reader = BufReader::new(File::open(path)?);
    let mut count = 0;
    for certificate in rustls_pemfile::certs(&mut reader) {
        roots
            .add(
                certificate
                    .map_err(|error| AgentError::Http(format!("invalid CA PEM: {error}")))?,
            )
            .map_err(|error| AgentError::Http(format!("invalid CA certificate: {error}")))?;
        count += 1;
    }
    if count == 0 {
        return Err(AgentError::Config(format!(
            "CA_CERT_PATH contains no certificates: {}",
            path.display()
        )));
    }
    Ok(ClientConfig::builder()
        .with_root_certificates(roots)
        .with_no_client_auth())
}

fn map_ureq_error(error: ureq::Error) -> AgentError {
    match error {
        ureq::Error::StatusCode(status) => AgentError::HttpStatus(status),
        error => AgentError::Http(error.to_string()),
    }
}

fn parse_status(response: &[u8]) -> Result<u16, AgentError> {
    let line_end = response
        .windows(2)
        .position(|part| part == b"\r\n")
        .unwrap_or(response.len());
    let line = std::str::from_utf8(&response[..line_end])
        .map_err(|_| AgentError::Http("invalid HTTP response".to_owned()))?;
    line.split_whitespace()
        .nth(1)
        .ok_or_else(|| AgentError::Http("missing HTTP status".to_owned()))?
        .parse()
        .map_err(|_| AgentError::Http("invalid HTTP status".to_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_http_status() {
        assert_eq!(parse_status(b"HTTP/1.1 201 Created\r\n").unwrap(), 201);
    }

    #[test]
    fn dns_resolution_times_out() {
        let result = resolve_socket_addr_with_timeout(
            "1.1.1.1.invalid.example",
            80,
            Duration::from_nanos(1),
        );
        assert!(matches!(result, Err(AgentError::DnsTimeout)));
    }
}

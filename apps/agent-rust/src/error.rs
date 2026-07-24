use std::io;

use thiserror::Error;

/// Errors that can be handled without terminating the Windows service.
#[derive(Debug, Error)]
pub enum AgentError {
    #[error("configuration error: {0}")]
    Config(String),
    #[error("I/O error: {0}")]
    Io(#[from] io::Error),
    #[error("DNS resolution error: {0}")]
    Http(String),
    #[error("DNS resolution timeout")]
    DnsTimeout,
    #[error("HTTP server returned status {0}")]
    HttpStatus(u16),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[cfg_attr(not(windows), allow(dead_code))]
    #[error("Windows API error: {0}")]
    Windows(u32),
    #[cfg_attr(not(windows), allow(dead_code))]
    #[error("unsupported platform: this binary must run on Windows")]
    UnsupportedPlatform,
}

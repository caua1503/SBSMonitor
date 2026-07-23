use std::io;

use thiserror::Error;

/// Errors that can be handled without terminating the Windows service.
#[derive(Debug, Error)]
pub enum AgentError {
    #[error("configuration error: {0}")]
    Config(String),
    #[error("I/O error: {0}")]
    Io(#[from] io::Error),
    #[error("HTTP transport error: {0}")]
    Http(String),
    #[error("HTTP server returned status {0}")]
    HttpStatus(u16),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Windows API error: {0}")]
    Windows(u32),
    #[error("unsupported platform: this binary must run on Windows")]
    UnsupportedPlatform,
}

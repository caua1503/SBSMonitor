#![cfg_attr(windows, windows_subsystem = "console")]

#[cfg(windows)]
mod collectors;
mod config;
mod error;
#[cfg(windows)]
mod http_client;
mod models;
#[cfg(windows)]
mod runner;
#[cfg(windows)]
mod service;

#[cfg(windows)]
fn main() {
    initialize_logging();
    let result = if std::env::args().any(|argument| argument == "--console") {
        service::run_console();
        Ok(())
    } else {
        service::run_service().map_err(|error| error.to_string())
    };
    if let Err(error) = result {
        log::error!("service dispatcher failed: {error}");
    }
}

#[cfg(windows)]
fn initialize_logging() {
    use simplelog::{ConfigBuilder, LevelFilter, WriteLogger};
    use std::{fs::File, path::PathBuf};
    let directory = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|parent| parent.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));
    if let Ok(file) = File::create(directory.join("agent-rust.log")) {
        let _ = WriteLogger::init(LevelFilter::Info, ConfigBuilder::new().build(), file);
    }
}

#[cfg(not(windows))]
fn main() {
    eprintln!("sbsmonitor-agent-rust must be built and run for Windows");
}

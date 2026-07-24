#![cfg_attr(windows, windows_subsystem = "console")]

mod collectors;
mod config;
mod error;
mod http_client;
mod models;
mod runner;
#[cfg(windows)]
mod service;

fn main() {
    initialize_logging();
    let result = if std::env::args().any(|argument| argument == "--console") {
        run_console();
        Ok(())
    } else {
        #[cfg(windows)]
        {
            service::run_service().map_err(|error| error.to_string())
        }
        #[cfg(not(windows))]
        {
            Err("Windows Service dispatcher is only supported on Windows. Run with --console on non-Windows platforms.".to_owned())
        }
    };
    if let Err(error) = result {
        log::error!("service dispatcher failed: {error}");
    }
}

fn run_console() {
    let (_stop_tx, stop_rx) = std::sync::mpsc::channel();
    log::info!("running in console mode; use Ctrl+C to terminate the process");
    run_with_receiver(stop_rx);
}

fn run_with_receiver(stop_rx: std::sync::mpsc::Receiver<()>) {
    match config::Config::load_from_executable_dir().and_then(runner::AgentRunner::new) {
        Ok(mut runner) => runner.run_until_stopped(&stop_rx),
        Err(error) => log::error!("agent initialization failed: {error}"),
    }
}

fn resolve_log_paths(
    exec_dir: &std::path::Path,
    program_data_env: Option<&str>,
) -> (std::path::PathBuf, std::path::PathBuf) {
    let primary = exec_dir.join("agent-rust.log");
    let fallback_base = match program_data_env {
        Some(val) if !val.trim().is_empty() => std::path::PathBuf::from(val),
        _ => {
            #[cfg(windows)]
            {
                std::path::PathBuf::from("C:\\ProgramData")
            }
            #[cfg(not(windows))]
            {
                std::path::PathBuf::from("/tmp")
            }
        }
    };
    let fallback = fallback_base.join("SBSMonitor").join("agent-rust.log");
    (primary, fallback)
}

fn initialize_logging() {
    use simplelog::{ConfigBuilder, LevelFilter, WriteLogger};
    use std::{
        fs::{self, File},
        path::PathBuf,
    };

    let directory = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|parent| parent.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));

    let program_data_env = std::env::var("ProgramData").ok();
    let (primary_path, fallback_path) = resolve_log_paths(&directory, program_data_env.as_deref());

    // Primary attempt: Beside the executable.
    // Fallback attempt: In %ProgramData% (or /tmp on Unix). Essential when running under a restricted
    // or custom Windows service account without write permissions to the installation directory.
    let log_file = File::create(&primary_path).or_else(|primary_err| {
        if let Some(parent) = fallback_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        File::create(&fallback_path).map_err(|fallback_err| {
            eprintln!(
                "failed to initialize log file at primary path ({}) [{}] and fallback path ({}) [{}]",
                primary_path.display(),
                primary_err,
                fallback_path.display(),
                fallback_err
            );
            fallback_err
        })
    });

    if let Ok(file) = log_file {
        let _ = WriteLogger::init(LevelFilter::Info, ConfigBuilder::new().build(), file);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn resolves_primary_and_fallback_log_paths() {
        let exec_dir = Path::new("/opt/sbsmonitor");
        let (primary, fallback) = resolve_log_paths(exec_dir, Some("/var/log"));
        assert_eq!(primary, Path::new("/opt/sbsmonitor/agent-rust.log"));
        assert_eq!(fallback, Path::new("/var/log/SBSMonitor/agent-rust.log"));
    }

    #[test]
    fn resolves_fallback_path_without_env_var() {
        let exec_dir = Path::new("/opt/sbsmonitor");
        let (_primary, fallback) = resolve_log_paths(exec_dir, None);
        #[cfg(windows)]
        assert_eq!(
            fallback,
            Path::new("C:\\ProgramData\\SBSMonitor\\agent-rust.log")
        );
        #[cfg(not(windows))]
        assert_eq!(fallback, Path::new("/tmp/SBSMonitor/agent-rust.log"));
    }
}

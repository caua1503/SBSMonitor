use std::{sync::mpsc, time::Duration};

use log::{error, info};
use windows_service::{
    define_windows_service,
    service::{
        ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
        ServiceType,
    },
    service_control_handler::{self, ServiceControlHandlerResult},
    service_dispatcher,
};

use crate::{config::Config, runner::AgentRunner};

const SERVICE_NAME: &str = "SBSMonitorAgentRust";

define_windows_service!(ffi_service_main, service_main);

/// Starts the SCM dispatcher. `--console` uses `run_console` instead for diagnostics.
pub fn run_service() -> windows_service::Result<()> {
    service_dispatcher::start(SERVICE_NAME, ffi_service_main)
}

fn service_main(_arguments: Vec<std::ffi::OsString>) {
    let (stop_tx, stop_rx) = mpsc::channel();
    let status_handle =
        match service_control_handler::register(SERVICE_NAME, move |control| match control {
            ServiceControl::Stop | ServiceControl::Shutdown => {
                let _ = stop_tx.send(());
                ServiceControlHandlerResult::NoError
            }
            _ => ServiceControlHandlerResult::NotImplemented,
        }) {
            Ok(handle) => handle,
            Err(error) => {
                error!("cannot register service handler: {error}");
                return;
            }
        };
    let running = service_status(
        ServiceState::Running,
        ServiceControlAccept::STOP | ServiceControlAccept::SHUTDOWN,
    );
    if let Err(error) = status_handle.set_service_status(running) {
        error!("cannot set service running: {error}");
        return;
    }
    run_with_receiver(stop_rx);
    let _ = status_handle.set_service_status(service_status(
        ServiceState::Stopped,
        ServiceControlAccept::empty(),
    ));
}

pub fn run_console() {
    let (_stop_tx, stop_rx) = mpsc::channel();
    info!("running in console mode; use Ctrl+C to terminate the process");
    run_with_receiver(stop_rx);
}

fn run_with_receiver(stop_rx: mpsc::Receiver<()>) {
    match Config::load_from_executable_dir().and_then(AgentRunner::new) {
        Ok(mut runner) => runner.run_until_stopped(&stop_rx),
        Err(error) => error!("agent initialization failed: {error}"),
    }
}

fn service_status(state: ServiceState, accepted: ServiceControlAccept) -> ServiceStatus {
    ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: state,
        controls_accepted: accepted,
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    }
}

use std::{sync::mpsc::Receiver, time::Instant};

use log::{error, info, warn};

use crate::{
    collectors, config::Config, error::AgentError, http_client::HttpClient, models::MetricsPayload,
};

/// Coordinates collection and delivery without overlapping collection cycles.
pub struct AgentRunner {
    config: Config,
    client: HttpClient,
    registered: bool,
}

impl AgentRunner {
    pub fn new(config: Config) -> Result<Self, AgentError> {
        let client = HttpClient::new(&config)?;
        Ok(Self {
            config,
            client,
            registered: false,
        })
    }

    pub fn run_until_stopped(&mut self, stop: &Receiver<()>) {
        loop {
            let started = Instant::now();
            self.run_cycle();
            let remaining = self
                .config
                .collect_interval
                .saturating_sub(started.elapsed());
            if stop.recv_timeout(remaining).is_ok() {
                break;
            }
        }
        info!("agent stopped");
    }

    fn run_cycle(&mut self) {
        if !self.registered {
            match self.client.register() {
                Ok(()) => {
                    self.registered = true;
                    info!("agent registered");
                }
                Err(error) => {
                    warn!("registration failed; retrying next cycle: {error}");
                    return;
                }
            }
        }
        match self
            .collect_all()
            .and_then(|metrics| self.client.send_metrics(&metrics))
        {
            Ok(()) => info!("metrics sent"),
            Err(error) => {
                if matches!(error, AgentError::HttpStatus(401)) {
                    self.registered = false;
                }
                error!("metric cycle failed: {error}");
            }
        }
    }

    fn collect_all(&self) -> Result<MetricsPayload, AgentError> {
        Ok(MetricsPayload {
            agent_id: self.config.agent_id.clone(),
            cpu: collectors::collect_cpu(std::time::Duration::from_millis(100))?,
            memory: collectors::collect_memory()?,
            disk: collectors::collect_system_disk()?,
            network: collectors::collect_primary_ipv4(),
            system: collectors::collect_process_count()?,
            collected_at: collectors::utc_timestamp(),
        })
    }
}

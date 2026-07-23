use serde::Serialize;

/// CPU utilization measured during a short sample window.
#[derive(Debug, Clone, Serialize)]
pub struct CpuMetrics {
    pub used_percentage: f64,
}

/// Physical-memory usage in bytes.
#[derive(Debug, Clone, Serialize)]
pub struct MemoryMetrics {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub used_percentage: f64,
}

/// System-drive usage in bytes.
#[derive(Debug, Clone, Serialize)]
pub struct DiskMetrics {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub used_percentage: f64,
}

/// Primary IPv4 address reported by the agent.
#[derive(Debug, Clone, Serialize)]
pub struct NetworkMetrics {
    pub ip: String,
}

/// Process count on the host.
#[derive(Debug, Clone, Serialize)]
pub struct SystemMetrics {
    pub process_count: u32,
}

/// JSON body accepted by `POST /api/v1/agents/register`.
#[derive(Debug, Clone, Serialize)]
pub struct RegisterPayload {
    pub hostname: String,
    pub platform: &'static str,
    pub ip: String,
}

/// JSON body accepted by `POST /api/v1/agents/metrics`.
#[derive(Debug, Clone, Serialize)]
pub struct MetricsPayload {
    pub agent_id: String,
    pub cpu: CpuMetrics,
    pub memory: MemoryMetrics,
    pub disk: DiskMetrics,
    pub network: NetworkMetrics,
    pub system: SystemMetrics,
    pub collected_at: String,
}

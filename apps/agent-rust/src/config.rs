use std::{
    collections::HashMap,
    env,
    path::{Path, PathBuf},
    str::FromStr,
    time::Duration,
};

use crate::error::AgentError;

/// Validated runtime settings loaded only from the `.env` beside the executable.
#[derive(Debug, Clone)]
pub struct Config {
    pub server_url: String,
    pub agent_id: String,
    pub agent_secret: String,
    pub collect_interval: Duration,
    pub request_timeout: Duration,
    pub ca_cert_path: Option<PathBuf>,
    #[allow(dead_code)]
    pub executable_dir: PathBuf,
}

impl Config {
    /// Loads the deployment-local `.env`, deliberately independent from the Bun agent.
    pub fn load_from_executable_dir() -> Result<Self, AgentError> {
        let executable = env::current_exe().map_err(AgentError::Io)?;
        let directory = executable
            .parent()
            .ok_or_else(|| AgentError::Config("executable has no parent directory".to_owned()))?
            .to_path_buf();
        Self::load_from_dir(&directory)
    }

    fn load_from_dir(directory: &Path) -> Result<Self, AgentError> {
        let dotenv_path = directory.join(".env");
        let values = dotenvy::from_path_iter(&dotenv_path)
            .map_err(|error| {
                AgentError::Config(format!("cannot read {}: {error}", dotenv_path.display()))
            })?
            .collect::<Result<HashMap<_, _>, _>>()
            .map_err(|error| {
                AgentError::Config(format!("invalid {}: {error}", dotenv_path.display()))
            })?;
        Self::from_values(values, directory)
    }

    fn from_values(values: HashMap<String, String>, directory: &Path) -> Result<Self, AgentError> {
        let server_url = required(&values, "SERVER_URL")?;
        let parsed = url::Url::parse(&server_url)
            .map_err(|error| AgentError::Config(format!("SERVER_URL is invalid: {error}")))?;
        if (parsed.scheme() != "https" && parsed.scheme() != "http") || parsed.host_str().is_none() {
            return Err(AgentError::Config(
                "SERVER_URL must be an absolute http or https URL".to_owned(),
            ));
        }

        let collect_interval = parse_number(&values, "COLLECT_INTERVAL", 60_u64)?;
        if collect_interval == 0 {
            return Err(AgentError::Config(
                "COLLECT_INTERVAL must be greater than zero".to_owned(),
            ));
        }
        let request_timeout = parse_number(&values, "REQUEST_TIMEOUT", 10_000_u64)?;
        if request_timeout == 0 {
            return Err(AgentError::Config(
                "REQUEST_TIMEOUT must be greater than zero".to_owned(),
            ));
        }

        let ca_cert_path = values
            .get("CA_CERT_PATH")
            .filter(|value| !value.trim().is_empty())
            .map(|value| {
                let path = PathBuf::from(value);
                if path.is_absolute() {
                    path
                } else {
                    directory.join(path)
                }
            });

        Ok(Self {
            server_url: server_url.trim_end_matches('/').to_owned(),
            agent_id: required(&values, "AGENT_ID")?,
            agent_secret: required(&values, "AGENT_SECRET")?,
            collect_interval: Duration::from_secs(collect_interval),
            request_timeout: Duration::from_millis(request_timeout),
            ca_cert_path,
            executable_dir: directory.to_path_buf(),
        })
    }
}

fn required(values: &HashMap<String, String>, key: &str) -> Result<String, AgentError> {
    values
        .get(key)
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| AgentError::Config(format!("missing required variable: {key}")))
}

fn parse_number<T>(values: &HashMap<String, String>, key: &str, default: T) -> Result<T, AgentError>
where
    T: FromStr + Copy,
    T::Err: std::fmt::Display,
{
    match values.get(key).filter(|value| !value.trim().is_empty()) {
        Some(value) => value
            .parse()
            .map_err(|error| AgentError::Config(format!("{key} is invalid: {error}"))),
        None => Ok(default),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn values(server_url: &str) -> HashMap<String, String> {
        [
            ("SERVER_URL", server_url),
            ("AGENT_ID", "agent-1"),
            ("AGENT_SECRET", "secret"),
        ]
        .into_iter()
        .map(|(key, value)| (key.to_owned(), value.to_owned()))
        .collect()
    }

    #[test]
    fn accepts_http_and_https_server() {
        assert!(Config::from_values(values("http://example.test"), Path::new(".")).is_ok());
        assert!(Config::from_values(values("https://example.test"), Path::new(".")).is_ok());
    }

    #[test]
    fn rejects_invalid_server_scheme() {
        assert!(Config::from_values(values("ftp://example.test"), Path::new(".")).is_err());
        assert!(Config::from_values(values("not-a-url"), Path::new(".")).is_err());
    }

    #[test]
    fn normalizes_server_url_and_defaults() {
        let config =
            Config::from_values(values("https://example.test/"), Path::new("C:\\agent")).unwrap();
        assert_eq!(config.server_url, "https://example.test");
        assert_eq!(config.collect_interval, Duration::from_secs(60));
    }
}

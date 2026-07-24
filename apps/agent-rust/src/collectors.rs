//! System metric collectors. Win32 implementation for Windows XP+, and mock implementations for non-Windows platforms.

use std::time::Duration;

#[cfg(windows)]
use std::{
    ffi::CStr,
    mem::{size_of, zeroed},
    thread,
};

#[cfg(windows)]
use windows_sys::{
    core::BOOL,
    Win32::{
        Foundation::{GetLastError, FILETIME, SYSTEMTIME},
        NetworkManagement::IpHelper::{GetAdaptersInfo, IP_ADAPTER_INFO},
        Storage::FileSystem::GetDiskFreeSpaceExW,
        System::{
            ProcessStatus::EnumProcesses,
            SystemInformation::{GetSystemTime, GlobalMemoryStatusEx, MEMORYSTATUSEX},
            Threading::GetSystemTimes,
            WindowsProgramming::GetComputerNameW,
        },
    },
};

use crate::{
    error::AgentError,
    models::{CpuMetrics, DiskMetrics, MemoryMetrics, NetworkMetrics, SystemMetrics},
};

#[cfg(any(windows, test))]
pub fn calculate_cpu_percentage(idle_delta: u64, total_delta: u64) -> f64 {
    if total_delta == 0 {
        0.0
    } else {
        let pct = (1.0 - idle_delta as f64 / total_delta as f64) * 100.0;
        round_two(pct.clamp(0.0, 100.0))
    }
}

#[cfg(any(windows, test))]
fn bytes_metrics<T>(total: u64, free: u64, make: impl FnOnce(u64, u64) -> T) -> T {
    make(total, free)
}

#[cfg(any(windows, test))]
fn percentage(total: u64, free: u64) -> f64 {
    round_two(if total == 0 {
        0.0
    } else {
        (total.saturating_sub(free) as f64 / total as f64) * 100.0
    })
}

#[cfg(any(windows, test))]
fn round_two(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

#[cfg(windows)]
fn bool_result(result: BOOL) -> Result<(), AgentError> {
    if result != 0 {
        Ok(())
    } else {
        Err(AgentError::Windows(unsafe { GetLastError() }))
    }
}

#[cfg(windows)]
fn filetime_value(value: FILETIME) -> u64 {
    ((value.dwHighDateTime as u64) << 32) | value.dwLowDateTime as u64
}

/// Reads aggregate CPU idle and total ticks using the XP-compatible `GetSystemTimes` API.
#[cfg(windows)]
pub fn read_cpu_times() -> Result<(u64, u64), AgentError> {
    let (mut idle, mut kernel, mut user) = unsafe { (zeroed(), zeroed(), zeroed()) };
    bool_result(unsafe { GetSystemTimes(&mut idle, &mut kernel, &mut user) })?;
    Ok((
        filetime_value(idle),
        filetime_value(kernel) + filetime_value(user),
    ))
}

/// Samples CPU utilization over `sample` without an asynchronous runtime.
#[cfg(windows)]
pub fn collect_cpu(sample: Duration) -> Result<CpuMetrics, AgentError> {
    let (idle_start, total_start) = read_cpu_times()?;
    thread::sleep(sample);
    let (idle_end, total_end) = read_cpu_times()?;
    let total_delta = total_end.saturating_sub(total_start);
    let idle_delta = idle_end.saturating_sub(idle_start);
    Ok(CpuMetrics {
        used_percentage: calculate_cpu_percentage(idle_delta, total_delta),
    })
}

/// Collects physical memory through `GlobalMemoryStatusEx` (available on XP).
#[cfg(windows)]
pub fn collect_memory() -> Result<MemoryMetrics, AgentError> {
    let mut status: MEMORYSTATUSEX = unsafe { zeroed() };
    status.dwLength = size_of::<MEMORYSTATUSEX>() as u32;
    bool_result(unsafe { GlobalMemoryStatusEx(&mut status) })?;
    let total = status.ullTotalPhys;
    let free = status.ullAvailPhys;
    Ok(bytes_metrics(total, free, |total, free| MemoryMetrics {
        total_bytes: total,
        free_bytes: free,
        used_bytes: total.saturating_sub(free),
        used_percentage: percentage(total, free),
    }))
}

/// Collects `C:\\` capacity using `GetDiskFreeSpaceExW`.
#[cfg(windows)]
pub fn collect_system_disk() -> Result<DiskMetrics, AgentError> {
    let root: Vec<u16> = "C:\\".encode_utf16().chain(Some(0)).collect();
    let (mut available, mut total, mut free) = (0_u64, 0_u64, 0_u64);
    bool_result(unsafe {
        GetDiskFreeSpaceExW(root.as_ptr(), &mut available, &mut total, &mut free)
    })?;
    Ok(bytes_metrics(total, free, |total, free| DiskMetrics {
        total_bytes: total,
        free_bytes: free,
        used_bytes: total.saturating_sub(free),
        used_percentage: percentage(total, free),
    }))
}

/// Returns the first non-loopback IPv4 address, matching the Bun-agent fallback behavior.
#[cfg(windows)]
pub fn collect_primary_ipv4() -> NetworkMetrics {
    let mut size = 0_u32;
    unsafe { GetAdaptersInfo(std::ptr::null_mut(), &mut size) };
    if size == 0 {
        return NetworkMetrics {
            ip: "127.0.0.1".to_owned(),
        };
    }
    let mut buffer = vec![0_u8; size as usize];
    let first = buffer.as_mut_ptr() as *mut IP_ADAPTER_INFO;
    if unsafe { GetAdaptersInfo(first, &mut size) } != 0 {
        return NetworkMetrics {
            ip: "127.0.0.1".to_owned(),
        };
    }
    let mut adapter = first;
    while !adapter.is_null() {
        let address = unsafe { CStr::from_ptr((*adapter).IpAddressList.IpAddress.String.as_ptr()) }
            .to_string_lossy()
            .into_owned();
        if address != "127.0.0.1" && address != "0.0.0.0" && !address.is_empty() {
            return NetworkMetrics { ip: address };
        }
        adapter = unsafe { (*adapter).Next };
    }
    NetworkMetrics {
        ip: "127.0.0.1".to_owned(),
    }
}

/// Counts process IDs through `psapi.dll`, avoiding `tasklist.exe`.
#[cfg(windows)]
pub fn collect_process_count() -> Result<SystemMetrics, AgentError> {
    let mut ids = vec![0_u32; 1024];
    loop {
        let mut bytes_needed = 0_u32;
        bool_result(unsafe {
            EnumProcesses(
                ids.as_mut_ptr(),
                (ids.len() * size_of::<u32>()) as u32,
                &mut bytes_needed,
            )
        })?;
        if bytes_needed < (ids.len() * size_of::<u32>()) as u32 {
            return Ok(SystemMetrics {
                process_count: (bytes_needed as usize / size_of::<u32>()) as u32,
            });
        }
        ids.resize(ids.len() * 2, 0);
    }
}

/// Reads the hostname with `GetComputerNameW`.
#[cfg(windows)]
pub fn hostname() -> Result<String, AgentError> {
    let mut buffer = vec![0_u16; 256];
    let mut length = (buffer.len() - 1) as u32;
    bool_result(unsafe { GetComputerNameW(buffer.as_mut_ptr(), &mut length) })?;
    Ok(String::from_utf16_lossy(&buffer[..length as usize]))
}

/// Formats an XP-compatible `GetSystemTime` value as an ISO-8601 UTC timestamp.
#[cfg(windows)]
pub fn utc_timestamp() -> String {
    let mut time: SYSTEMTIME = unsafe { zeroed() };
    unsafe { GetSystemTime(&mut time) };
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        time.wYear,
        time.wMonth,
        time.wDay,
        time.wHour,
        time.wMinute,
        time.wSecond,
        time.wMilliseconds
    )
}

// -----------------------------------------------------------------------------
// Non-Windows Mock Implementation for local development and testing
// -----------------------------------------------------------------------------

/// Mock CPU collector for non-Windows platforms.
#[cfg(not(windows))]
pub fn collect_cpu(_sample: Duration) -> Result<CpuMetrics, AgentError> {
    Ok(CpuMetrics {
        used_percentage: 0.0,
    })
}

/// Mock memory collector for non-Windows platforms.
#[cfg(not(windows))]
pub fn collect_memory() -> Result<MemoryMetrics, AgentError> {
    Ok(MemoryMetrics {
        total_bytes: 8_589_934_592,
        free_bytes: 4_294_967_296,
        used_bytes: 4_294_967_296,
        used_percentage: 50.0,
    })
}

/// Mock disk collector for non-Windows platforms.
#[cfg(not(windows))]
pub fn collect_system_disk() -> Result<DiskMetrics, AgentError> {
    Ok(DiskMetrics {
        total_bytes: 100_000_000_000,
        free_bytes: 50_000_000_000,
        used_bytes: 50_000_000_000,
        used_percentage: 50.0,
    })
}

/// Mock network collector for non-Windows platforms.
#[cfg(not(windows))]
pub fn collect_primary_ipv4() -> NetworkMetrics {
    NetworkMetrics {
        ip: "127.0.0.1".to_owned(),
    }
}

/// Mock process count collector for non-Windows platforms.
#[cfg(not(windows))]
pub fn collect_process_count() -> Result<SystemMetrics, AgentError> {
    Ok(SystemMetrics { process_count: 42 })
}

/// Mock hostname collector for non-Windows platforms.
#[cfg(not(windows))]
pub fn hostname() -> Result<String, AgentError> {
    Ok("localhost-mock".to_owned())
}

/// Mock UTC timestamp generator for non-Windows platforms.
#[cfg(not(windows))]
pub fn utc_timestamp() -> String {
    "2026-07-24T12:00:00.000Z".to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rounds_percentage_to_two_places() {
        assert_eq!(round_two(12.345), 12.35);
    }
    #[test]
    fn calculates_percentage() {
        assert_eq!(percentage(100, 25), 75.0);
    }
    #[test]
    fn clamps_cpu_percentage_to_valid_range() {
        // Underflow case where idle_delta > total_delta (timer jitter)
        assert_eq!(calculate_cpu_percentage(150, 100), 0.0);
        // Normal case (25% used, so idle_delta is 75 out of 100)
        assert_eq!(calculate_cpu_percentage(75, 100), 25.0);
        // 100% used (idle_delta is 0)
        assert_eq!(calculate_cpu_percentage(0, 100), 100.0);
        // Edge case total_delta == 0
        assert_eq!(calculate_cpu_percentage(0, 0), 0.0);
    }
}

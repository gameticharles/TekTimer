use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TimerStatus {
    Idle,
    Running,
    Paused,
    Ended,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerState {
    pub id: String,
    pub label: String,
    pub duration_seconds: u64,
    pub remaining_seconds: u64,
    pub status: TimerStatus,
    pub end_time_unix: Option<u64>,
}

pub struct AppState {
    pub timers: Arc<Mutex<HashMap<String, TimerState>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            timers: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

pub fn unix_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

use crate::timer::{unix_now, AppState, TimerState, TimerStatus};
use uuid::Uuid;

#[tauri::command]
pub fn create_timer(
    state: tauri::State<'_, AppState>,
    duration_seconds: u64,
    label: String,
) -> Result<TimerState, String> {
    let id = Uuid::new_v4().to_string();
    let timer = TimerState {
        id: id.clone(),
        label,
        duration_seconds,
        remaining_seconds: duration_seconds,
        status: TimerStatus::Idle,
        end_time_unix: None,
    };
    let mut map = state.timers.lock().map_err(|e| e.to_string())?;
    map.insert(id, timer.clone());
    Ok(timer)
}

#[tauri::command]
pub fn start_timer(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<TimerState, String> {
    let now = unix_now();
    let mut map = state.timers.lock().map_err(|e| e.to_string())?;
    let timer = map.get_mut(&id).ok_or("Timer not found")?;

    if timer.status == TimerStatus::Running {
        return Ok(timer.clone());
    }

    timer.end_time_unix = Some(now + timer.remaining_seconds);
    timer.status = TimerStatus::Running;
    Ok(timer.clone())
}

#[tauri::command]
pub fn pause_timer(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<TimerState, String> {
    let now = unix_now();
    let mut map = state.timers.lock().map_err(|e| e.to_string())?;
    let timer = map.get_mut(&id).ok_or("Timer not found")?;

    if timer.status != TimerStatus::Running {
        return Ok(timer.clone());
    }

    timer.remaining_seconds = timer
        .end_time_unix
        .unwrap_or(now)
        .saturating_sub(now);
    timer.end_time_unix = None;
    timer.status = TimerStatus::Paused;
    Ok(timer.clone())
}

#[tauri::command]
pub fn reset_timer(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<TimerState, String> {
    let mut map = state.timers.lock().map_err(|e| e.to_string())?;
    let timer = map.get_mut(&id).ok_or("Timer not found")?;

    timer.remaining_seconds = timer.duration_seconds;
    timer.end_time_unix = None;
    timer.status = TimerStatus::Idle;
    Ok(timer.clone())
}

#[tauri::command]
pub fn delete_timer(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let mut map = state.timers.lock().map_err(|e| e.to_string())?;
    map.remove(&id).ok_or("Timer not found")?;
    Ok(())
}

#[tauri::command]
pub fn add_extra_time(
    state: tauri::State<'_, AppState>,
    id: String,
    extraSeconds: u64,
) -> Result<TimerState, String> {
    let mut map = state.timers.lock().map_err(|e| e.to_string())?;
    let timer = map.get_mut(&id).ok_or("Timer not found")?;

    timer.duration_seconds += extraSeconds;
    timer.remaining_seconds += extraSeconds;

    // If currently running, push end_time forward by the same amount
    if timer.status == TimerStatus::Running {
        if let Some(end) = timer.end_time_unix.as_mut() {
            *end += extraSeconds;
        }
    }

    // If the timer had ended and we added time, revive it
    if timer.status == TimerStatus::Ended {
        let now = unix_now();
        timer.end_time_unix = Some(now + timer.remaining_seconds);
        timer.status = TimerStatus::Running;
    }

    Ok(timer.clone())
}

#[tauri::command]
pub fn update_timer(
    state: tauri::State<'_, AppState>,
    id: String,
    new_duration_seconds: Option<u64>,
    new_label: Option<String>,
) -> Result<TimerState, String> {
    let mut map = state.timers.lock().map_err(|e| e.to_string())?;
    let timer = map.get_mut(&id).ok_or("Timer not found")?;

    if let Some(label) = new_label {
        timer.label = label;
    }

    if let Some(new_duration) = new_duration_seconds {
        // Calculate the difference between the new duration and the old duration
        let diff = new_duration as i64 - timer.duration_seconds as i64;
        
        timer.duration_seconds = new_duration;

        // Apply difference to remaining_seconds and clamp to 0
        timer.remaining_seconds = (timer.remaining_seconds as i64 + diff).max(0) as u64;

        if timer.status == TimerStatus::Running {
            if let Some(end) = timer.end_time_unix.as_mut() {
                // Adjust the end time based on the difference
                *end = (*end as i64 + diff).max(0) as u64;
            }
        }

        // If the timer had ended but we added time, we don't automatically revive it
        // like we do with add_extra_time. The user editing the duration might just be
        // fixing a mistake or resetting it manually. But if remaining > 0 and status is Ended,
        // we should probably bump it back to Paused or Idle.
        if timer.status == TimerStatus::Ended && timer.remaining_seconds > 0 {
            timer.status = TimerStatus::Paused;
            timer.end_time_unix = None;
        } else if timer.remaining_seconds == 0 {
            // If they shortened the duration to less than what had already elapsed, end it
            timer.status = TimerStatus::Ended;
            timer.end_time_unix = None;
        }
    }

    Ok(timer.clone())
}

#[tauri::command]
pub fn pause_all_timers(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let now = unix_now();
    let mut map = state.timers.lock().map_err(|e| e.to_string())?;
    for timer in map.values_mut() {
        if timer.status == TimerStatus::Running {
            timer.remaining_seconds = timer
                .end_time_unix
                .unwrap_or(now)
                .saturating_sub(now);
            timer.end_time_unix = None;
            timer.status = TimerStatus::Paused;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn resume_all_timers(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let now = unix_now();
    let mut map = state.timers.lock().map_err(|e| e.to_string())?;
    for timer in map.values_mut() {
        if timer.status == TimerStatus::Paused {
            timer.end_time_unix = Some(now + timer.remaining_seconds);
            timer.status = TimerStatus::Running;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn set_fullscreen(
    window: tauri::Window,
    fullscreen: bool,
) -> Result<(), String> {
    window
        .set_fullscreen(fullscreen)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn sync_timers(
    state: tauri::State<'_, AppState>,
    timers: Vec<TimerState>,
) -> Result<(), String> {
    let now = unix_now();
    let mut map = state.timers.lock().map_err(|e| e.to_string())?;
    map.clear();
    for mut timer in timers {
        if timer.status == TimerStatus::Running {
            if let Some(end_time) = timer.end_time_unix {
                if end_time > now {
                    timer.remaining_seconds = end_time - now;
                } else {
                    timer.remaining_seconds = 0;
                    timer.status = TimerStatus::Ended;
                }
            }
        }
        map.insert(timer.id.clone(), timer);
    }
    Ok(())
}

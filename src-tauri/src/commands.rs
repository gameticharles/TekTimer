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
    extra_seconds: u64,
) -> Result<TimerState, String> {
    let mut map = state.timers.lock().map_err(|e| e.to_string())?;
    let timer = map.get_mut(&id).ok_or("Timer not found")?;

    timer.duration_seconds += extra_seconds;
    timer.remaining_seconds += extra_seconds;

    // If currently running, push end_time forward by the same amount
    if timer.status == TimerStatus::Running {
        if let Some(end) = timer.end_time_unix.as_mut() {
            *end += extra_seconds;
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

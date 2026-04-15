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
pub fn start_timer(state: tauri::State<'_, AppState>, id: String) -> Result<TimerState, String> {
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
pub fn pause_timer(state: tauri::State<'_, AppState>, id: String) -> Result<TimerState, String> {
    let now = unix_now();
    let mut map = state.timers.lock().map_err(|e| e.to_string())?;
    let timer = map.get_mut(&id).ok_or("Timer not found")?;

    if timer.status != TimerStatus::Running {
        return Ok(timer.clone());
    }

    timer.remaining_seconds = timer.end_time_unix.unwrap_or(now).saturating_sub(now);
    timer.end_time_unix = None;
    timer.status = TimerStatus::Paused;
    Ok(timer.clone())
}

#[tauri::command]
pub fn reset_timer(state: tauri::State<'_, AppState>, id: String) -> Result<TimerState, String> {
    let mut map = state.timers.lock().map_err(|e| e.to_string())?;
    let timer = map.get_mut(&id).ok_or("Timer not found")?;

    timer.remaining_seconds = timer.duration_seconds;
    timer.end_time_unix = None;
    timer.status = TimerStatus::Idle;
    Ok(timer.clone())
}

#[tauri::command]
pub fn delete_timer(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    let mut map = state.timers.lock().map_err(|e| e.to_string())?;
    map.remove(&id).ok_or("Timer not found")?;
    Ok(())
}

#[tauri::command]
pub fn add_extra_time(
    state: tauri::State<'_, AppState>,
    id: String,
    extra_seconds: i64,
) -> Result<TimerState, String> {
    let mut map = state.timers.lock().map_err(|e| e.to_string())?;
    let timer = map.get_mut(&id).ok_or("Timer not found")?;

    // Use i64 arithmetic to avoid underflow; clamp to 0
    let new_remaining = (timer.remaining_seconds as i64 + extra_seconds).max(0) as u64;
    let new_duration = (timer.duration_seconds as i64 + extra_seconds).max(0) as u64;

    timer.duration_seconds = new_duration;
    timer.remaining_seconds = new_remaining;

    // If currently running, adjust end_time accordingly
    if timer.status == TimerStatus::Running {
        if let Some(end) = timer.end_time_unix.as_mut() {
            *end = (*end as i64 + extra_seconds).max(0) as u64;
        }
    }

    if new_remaining == 0 {
        // Subtracted past zero — end the timer
        timer.status = TimerStatus::Ended;
        timer.end_time_unix = None;
    } else if timer.status == TimerStatus::Ended {
        // Added time back to an ended timer — revive it
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
pub fn pause_all_timers(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let now = unix_now();
    let mut map = state.timers.lock().map_err(|e| e.to_string())?;
    for timer in map.values_mut() {
        if timer.status == TimerStatus::Running {
            timer.remaining_seconds = timer.end_time_unix.unwrap_or(now).saturating_sub(now);
            timer.end_time_unix = None;
            timer.status = TimerStatus::Paused;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn resume_all_timers(state: tauri::State<'_, AppState>) -> Result<(), String> {
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
pub fn set_fullscreen(window: tauri::Window, fullscreen: bool) -> Result<(), String> {
    window.set_fullscreen(fullscreen).map_err(|e| e.to_string())
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

#[tauri::command]
pub fn copy_alarm_file(source_path: String, target_path: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let target = Path::new(&target_path);
    if let Some(parent) = target.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directories: {}", e))?;
        }
    }

    fs::copy(&source_path, &target_path).map_err(|e| format!("Failed to copy file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn copy_media_file(source_path: String, target_path: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let target = Path::new(&target_path);
    if let Some(parent) = target.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directories: {}", e))?;
        }
    }

    fs::copy(&source_path, &target_path).map_err(|e| format!("Failed to copy file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn delete_media_file(file_path: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let path = Path::new(&file_path);
    if path.exists() {
        fs::remove_file(path).map_err(|e| format!("Failed to delete file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn read_file_as_base64(file_path: String) -> Result<String, String> {
    use std::fs;
    use std::path::Path;
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    let path = Path::new(&file_path);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mov" => "video/quicktime",
        _ => "application/octet-stream",
    };

    let bytes = fs::read(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;
    let b64 = STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct MediaSlide {
    pub id: String,
    pub path: String,
    pub name: String,
    pub r#type: String,
    pub phases: Vec<String>,
}

#[tauri::command]
pub async fn ensure_default_slideshow_assets(app: tauri::AppHandle) -> Result<Vec<MediaSlide>, String> {
    use std::fs;
    use tauri::Manager;
    use uuid::Uuid;

    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let slideshow_dir = app_dir.join("slideshow");

    if !slideshow_dir.exists() {
        fs::create_dir_all(&slideshow_dir).map_err(|e| e.to_string())?;
    }

    // List of default images we bundled
    let default_files = vec!["image1.jpeg", "image2.jpeg", "image3.jpeg", "image4.jpeg", "image5.jpeg"];
    let mut slides = Vec::new();

    for filename in default_files {
        let dest_path = slideshow_dir.join(filename);
        
        // In Tauri v2, resources are accessed via path().resource_dir()
        let resource_dir = app.path().resource_dir().map_err(|e| format!("Could not get resource dir: {}", e))?;
        let bundled_path = resource_dir.join("resources").join("slideshow").join(filename);

        if !dest_path.exists() {
            fs::copy(&bundled_path, &dest_path).map_err(|e| format!("Failed to copy {} to AppData: {}", filename, e))?;
        }

        slides.push(MediaSlide {
            id: Uuid::new_v4().to_string(),
            path: dest_path.to_string_lossy().into_owned(),
            name: filename.to_string(),
            r#type: "image".to_string(),
            phases: vec!["start".to_string(), "middle".to_string(), "end".to_string()],
        });
    }

    Ok(slides)
}

mod commands;
mod timer;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use timer::{unix_now, TimerStatus};

fn start_tick_loop(
    app_handle: tauri::AppHandle,
    timers: Arc<std::sync::Mutex<std::collections::HashMap<String, timer::TimerState>>>,
) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            let now = unix_now();
            let mut map = match timers.lock() {
                Ok(m) => m,
                Err(_) => continue,
            };
            for timer in map.values_mut() {
                if timer.status != TimerStatus::Running {
                    continue;
                }
                let remaining = timer
                    .end_time_unix
                    .unwrap_or(now)
                    .saturating_sub(now);
                timer.remaining_seconds = remaining;
                if remaining == 0 {
                    timer.status = TimerStatus::Ended;
                    timer.end_time_unix = None;
                }
                let _ = app_handle.emit(
                    "timer-tick",
                    serde_json::json!({
                        "id": timer.id,
                        "remaining_seconds": remaining,
                        "status": timer.status,
                        "end_time_unix": timer.end_time_unix,
                    }),
                );
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = timer::AppState::new();
    let tick_timers = Arc::clone(&app_state.timers);

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::create_timer,
            commands::start_timer,
            commands::pause_timer,
            commands::reset_timer,
            commands::delete_timer,
            commands::add_extra_time,
            commands::pause_all_timers,
            commands::resume_all_timers,
            commands::set_fullscreen,
            commands::sync_timers,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            start_tick_loop(handle, tick_timers);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

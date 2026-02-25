# 🎓 Exam & Quiz Timer — App Development Specification v5.0

> **Document Purpose:** Complete technical specification for an AI coding agent (Cursor, Devin, GitHub Copilot) to implement a production-ready timer application from scratch. Read every section before writing a single line of code.
>
> **v5.0 Changes:** Added **Voice Announcement System** — automated TTS announcements at configurable time milestones, custom scripted messages per timer, ad-hoc manual announcements, announcement queue with collision prevention, and optional LLM-enhanced natural language generation.

---

## Table of Contents

1. [Project Overview & Goals](#1-project-overview--goals)
2. [App Modes](#2-app-modes)
3. [Tech Stack & Toolchain](#3-tech-stack--toolchain)
4. [Project Structure](#4-project-structure)
5. [Data Models](#5-data-models)
6. [Rust Backend Specification](#6-rust-backend-specification)
7. [Frontend Component Specification](#7-frontend-component-specification)
8. [UI Layout System](#8-ui-layout-system)
9. [Font Size System](#9-font-size-system) ← NEW
10. [Visual States & Animations](#10-visual-states--animations)
11. [Audio System](#11-audio-system)
12. [Fullscreen Presentation System](#12-fullscreen-presentation-system)
13. [Extra Time Feature](#13-extra-time-feature) ← NEW
14. [Blackout Mode](#14-blackout-mode) ← NEW
15. [Pause All / Resume All](#15-pause-all--resume-all) ← NEW
16. [Progress Bar](#16-progress-bar) ← NEW
17. [Settings Panel](#17-settings-panel) ← NEW (warning thresholds, sound, end message, persistence)
18. [Voice Announcement System](#18-voice-announcement-system) ← NEW
19. [Add Timer Modal](#19-add-timer-modal)
20. [Edge Cases & Error Handling](#20-edge-cases--error-handling)
21. [Accessibility & Usability](#21-accessibility--usability)
22. [Build & Packaging](#22-build--packaging)
23. [Implementation Order](#23-implementation-order)
24. [Appendices](#24-appendices)

---

## 1. Project Overview & Goals

### What This Is
A **cross-platform desktop application** that runs in **true OS fullscreen**, designed to display countdown timers on a projected screen in classrooms or lecture halls. Supports two modes:

- **Quiz Mode** — A single, maximally large timer for one timed activity
- **Exam Mode** — Up to 5 simultaneous timers for multi-session university examinations

### Primary Success Criteria
- [ ] App launches into OS-level fullscreen covering the entire display
- [ ] Timer text is legible from 15+ metres; font size is adjustable per-timer and globally
- [ ] Timers remain accurate even when OS throttles JavaScript (Rust backend is the clock)
- [ ] A quiz can be set up and started in under 15 seconds
- [ ] Ending a session triggers an unmissable audio-visual alert
- [ ] Invigilator can blackout the screen, pause all timers, and add extra time — all in one click
- [ ] Settings persist between application sessions
- [ ] Pressing `Escape` exits fullscreen without stopping timers

### Non-Goals
- No network or cloud sync
- No persistent history of past sessions
- No user accounts or authentication
- No database

---

## 2. App Modes

### 2.1 Home Screen (Mode Selector)

First screen on launch. Always shown in fullscreen.

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                    🎓  Exam & Quiz Timer                            │
│                                                                     │
│   ┌───────────────────────────┐   ┌───────────────────────────┐    │
│   │       📋  QUIZ MODE       │   │       📚  EXAM MODE       │    │
│   │  Single full-screen timer │   │  Up to 5 simultaneous     │    │
│   │  for one timed activity   │   │  timers for exam sessions │    │
│   └───────────────────────────┘   └───────────────────────────┘    │
│                                                                     │
│                                              [ ⚙ Settings ]        │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Quiz Mode

Single full-screen timer. See Sections 7–12 for implementation details.

Quick-launch modal fields: Label (optional), Hours + Minutes, "Start immediately" checkbox.

### 2.3 Exam Mode

Up to 5 named exam timers in a dynamic grid. See Sections 7–8 for layout.

---

## 3. Tech Stack & Toolchain

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Desktop Shell | **Tauri** | `^2.x` | Rust backend + WebView frontend |
| Frontend | **React** + TypeScript | `^18.x` / `^5.x` | `strict: true` |
| Styling | **Tailwind CSS** | `^3.x` | JIT mode |
| Icons | **lucide-react** | `^0.x` | Play, Pause, RotateCcw, Maximize, etc. |
| Build Tool | **Vite** | `^5.x` | Tauri default |
| Backend | **Rust** | `stable` 2021 edition | All timekeeping logic |
| Persistence | **tauri-plugin-store** | `^2.x` | Settings saved to disk as JSON |

### Rust Cargo Dependencies
```toml
[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
tauri-plugin-store = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
tokio = { version = "1", features = ["full"] }
```

---

## 4. Project Structure

```
exam-quiz-timer/
├── src/
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── QuizScreen.tsx
│   │   └── ExamScreen.tsx
│   ├── components/
│   │   ├── QuizTimer.tsx
│   │   ├── TimerCard.tsx
│   │   ├── TimerGrid.tsx
│   │   ├── QuizSetupModal.tsx
│   │   ├── AddExamTimerModal.tsx
│   │   ├── ExtraTimeModal.tsx         ← NEW
│   │   ├── DismissOverlay.tsx
│   │   ├── ControlBar.tsx
│   │   ├── ProgressBar.tsx            ← NEW
│   │   ├── FontSizeControl.tsx        ← NEW
│   │   ├── BlackoutScreen.tsx         ← NEW
│   │   ├── SettingsPanel.tsx          ← NEW
│   │   └── EmptyState.tsx
│   ├── hooks/
│   │   ├── useTimerStore.ts
│   │   ├── useTauriEvents.ts
│   │   ├── useFullscreen.ts
│   │   ├── useIdleControls.ts
│   │   ├── useSettings.ts             ← NEW
│   │   └── useBlackout.ts             ← NEW
│   ├── lib/
│   │   ├── types.ts
│   │   ├── formatTime.ts
│   │   ├── gridLayout.ts
│   │   ├── audioManager.ts
│   │   └── fontSizeUtils.ts           ← NEW
│   ├── assets/
│   │   └── bell.mp3
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── timer.rs
│   │   └── commands.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
```

---

## 5. Data Models

### 5.1 TypeScript Types

```typescript
// src/lib/types.ts

export type AppMode = 'home' | 'quiz' | 'exam';
export type TimerStatus = 'Idle' | 'Running' | 'Paused' | 'Ended';

// ─── Timer Types ─────────────────────────────────────────────────────

export interface TimerBase {
  id: string;
  label: string;
  durationSeconds: number;
  remainingSeconds: number;
  status: TimerStatus;
  isDismissed: boolean;
  // Per-timer font size override. null = use global setting.
  fontSizeOverride: number | null;
}

export interface QuizTimer extends TimerBase {
  mode: 'quiz';
}

export interface ExamTimer extends TimerBase {
  mode: 'exam';
  courseCode: string;
  program: string;
  studentCount: number;
}

export type AnyTimer = QuizTimer | ExamTimer;

// ─── Tick Payload (from Rust) ─────────────────────────────────────────

export interface TimerTickPayload {
  id: string;
  remainingSeconds: number;
  status: TimerStatus;
}

// ─── Settings ────────────────────────────────────────────────────────

export interface AppSettings {
  // Font sizes (percentage scale: 100 = default, 120 = 20% larger)
  globalFontScale: number;          // Range: 50–200. Default: 100.

  // Warning thresholds (in seconds)
  warningThresholdSeconds: number;  // Default: 300 (5 min)
  criticalThresholdSeconds: number; // Default: 60 (1 min)

  // Audio
  soundEnabled: boolean;            // Default: true
  alarmVolume: number;              // Range: 0–1. Default: 0.85
  customAlarmPath: string | null;   // Absolute path to user-supplied audio file

  // End state
  endMessage: string;               // Default: "Time's Up — Pens Down"

  // Progress bar
  showProgressBar: boolean;         // Default: true

  // Theme
  darkMode: boolean;                // Default: true (light mode option for bright rooms)
}

export const DEFAULT_SETTINGS: AppSettings = {
  globalFontScale: 100,
  warningThresholdSeconds: 300,
  criticalThresholdSeconds: 60,
  soundEnabled: true,
  alarmVolume: 0.85,
  customAlarmPath: null,
  endMessage: "Time's Up — Pens Down",
  showProgressBar: true,
  darkMode: true,
};
```

### 5.2 Rust Types

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TimerStatus { Idle, Running, Paused, Ended }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerState {
    pub id: String,
    pub duration_seconds: u64,
    pub remaining_seconds: u64,
    pub status: TimerStatus,
    pub end_time_unix: Option<u64>,
}
```

---

## 6. Rust Backend Specification

### 6.1 Core Principle
Rust owns all time calculation. `end_time_unix` is an absolute Unix timestamp. The frontend only renders; it never calculates elapsed time.

### 6.2 Tauri Commands

| Command | Input | Action |
|---|---|---|
| `create_timer` | `duration_seconds, label` | UUID, insert Idle state, return |
| `start_timer` | `id` | `end_time_unix = now + remaining`, status → Running |
| `pause_timer` | `id` | Recalc remaining, clear end_time, status → Paused |
| `reset_timer` | `id` | Restore `remaining = duration`, status → Idle |
| `delete_timer` | `id` | Remove from map |
| `add_extra_time` | `id, extra_seconds: u64` | See Section 13 |
| `pause_all_timers` | — | Pause every Running timer atomically |
| `resume_all_timers` | — | Resume every Paused timer atomically |
| `set_fullscreen` | `fullscreen: bool` | Native window fullscreen |

### 6.3 `add_extra_time` Command

```rust
#[tauri::command]
fn add_extra_time(
    state: tauri::State<'_, AppState>,
    id: String,
    extra_seconds: u64,
) -> Result<TimerState, String> {
    let mut map = state.timers.lock().unwrap();
    let timer = map.get_mut(&id).ok_or("Timer not found")?;

    timer.duration_seconds += extra_seconds;
    timer.remaining_seconds += extra_seconds;

    // If currently running, push end_time forward by the same amount
    if timer.status == TimerStatus::Running {
        if let Some(end) = timer.end_time_unix.as_mut() {
            *end += extra_seconds;
        }
    }

    Ok(timer.clone())
}
```

### 6.4 `pause_all_timers` / `resume_all_timers`

```rust
#[tauri::command]
fn pause_all_timers(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let now = unix_now();
    let mut map = state.timers.lock().unwrap();
    for timer in map.values_mut() {
        if timer.status == TimerStatus::Running {
            timer.remaining_seconds = timer.end_time_unix
                .unwrap_or(now).saturating_sub(now);
            timer.end_time_unix = None;
            timer.status = TimerStatus::Paused;
        }
    }
    Ok(())
}

#[tauri::command]
fn resume_all_timers(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let now = unix_now();
    let mut map = state.timers.lock().unwrap();
    for timer in map.values_mut() {
        if timer.status == TimerStatus::Paused {
            timer.end_time_unix = Some(now + timer.remaining_seconds);
            timer.status = TimerStatus::Running;
        }
    }
    Ok(())
}
```

### 6.5 Background Tick Loop

Single Tokio task, 500ms interval. Emits `timer-tick` event for every Running timer.

```rust
fn start_tick_loop(app_handle: tauri::AppHandle, timers: Arc<Mutex<HashMap<String, TimerState>>>) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            let now = unix_now();
            let mut map = timers.lock().unwrap();
            for timer in map.values_mut() {
                if timer.status != TimerStatus::Running { continue; }
                let remaining = timer.end_time_unix.unwrap_or(now).saturating_sub(now);
                timer.remaining_seconds = remaining;
                if remaining == 0 {
                    timer.status = TimerStatus::Ended;
                    timer.end_time_unix = None;
                }
                let _ = app_handle.emit("timer-tick", serde_json::json!({
                    "id": timer.id,
                    "remainingSeconds": remaining,
                    "status": timer.status,
                }));
            }
        }
    });
}

fn unix_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}
```

---

## 7. Frontend Component Specification

### 7.1 `App.tsx` — State Router

```typescript
const App = () => {
  const [mode, setMode] = useState<AppMode>('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [blackout, setBlackout] = useState(false);

  return (
    <>
      {blackout && <BlackoutScreen onReveal={() => setBlackout(false)} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      {mode === 'home' && <HomeScreen onSelect={setMode} onSettings={() => setSettingsOpen(true)} />}
      {mode === 'quiz' && <QuizScreen onExit={() => setMode('home')} onBlackout={() => setBlackout(true)} />}
      {mode === 'exam' && <ExamScreen onExit={() => setMode('home')} onBlackout={() => setBlackout(true)} />}
    </>
  );
};
```

### 7.2 `useSettings.ts` Hook

Wraps `tauri-plugin-store` for persistent settings.

```typescript
import { load } from '@tauri-apps/plugin-store';

const STORE_PATH = 'settings.json';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    (async () => {
      const store = await load(STORE_PATH, { autoSave: true });
      const saved = await store.get<AppSettings>('settings');
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...saved });
    })();
  }, []);

  const updateSettings = async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    const store = await load(STORE_PATH, { autoSave: true });
    await store.set('settings', next);
  };

  return { settings, updateSettings };
}
```

Settings are loaded once on mount and written immediately on every change. No "Save" button needed.

### 7.3 `QuizTimer.tsx`

See Section 2.2 for layout. Reads `fontSizeOverride` and `globalFontScale` to compute final clock size (see Section 9).

### 7.4 `TimerCard.tsx`

Each card in the exam grid. Props:

```typescript
interface TimerCardProps {
  timer: ExamTimer;
  settings: AppSettings;
  onStart: (id: string) => void;
  onPause: (id: string) => void;
  onReset: (id: string) => void;
  onDelete: (id: string) => void;
  onDismiss: (id: string) => void;
  onAddExtraTime: (id: string) => void;
  onFontSizeChange: (id: string, scale: number | null) => void;
}
```

Card layout:

```
┌──────────────────────────────────────────────────────────────┐
│  GEOM 261 · BSc Geomatic Engineering                    [✕]  │
│──────────────────────────────────────────────────────────────│
│  ████████████████████░░░░░░░░░░░  [progress bar]            │
│                                                              │
│                  01 : 23 : 45                               │
│                                                              │
│  [A−] [A+]          [+Time]  [▶ Start] [⏸ Pause] [↺ Reset] │
└──────────────────────────────────────────────────────────────┘
```

- `[A−]` / `[A+]` are the per-timer font size decrease/increase buttons (see Section 9)
- `[+Time]` opens `ExtraTimeModal` for this timer

### 7.5 `DismissOverlay.tsx`

Full-card overlay when `status === 'Ended' && !isDismissed`. Displays the customisable `endMessage` from settings.

```tsx
<div className="absolute inset-0 bg-red-900 flex flex-col items-center justify-center z-10">
  <p className="text-5xl font-black text-white mb-3 text-center px-4">
    {settings.endMessage}
  </p>
  <p className="text-2xl text-red-200 mb-10">{timer.courseCode || timer.label}</p>
  <button onClick={() => onDismiss(timer.id)} className="...">
    <BellOff size={20} /> Silence & Dismiss
  </button>
</div>
```

### 7.6 `BlackoutScreen.tsx`

See Section 14.

### 7.7 `SettingsPanel.tsx`

See Section 17.

---

## 8. UI Layout System

### 8.1 Quiz Mode

Full screen, single timer, nothing else visible.

```css
.quiz-clock {
  /* Base size set by CSS variable, scaled by font system */
  font-size: var(--quiz-clock-size);
  font-variant-numeric: tabular-nums;
  font-weight: 900;
  letter-spacing: 0.08em;
  line-height: 1;
}
```

### 8.2 Exam Mode Grid

Sort by `studentCount` descending before render.

| Count | Grid Class | Special Rule |
|---|---|---|
| 1 | `grid-cols-1 grid-rows-1` | Full screen |
| 2 | `grid-cols-2 grid-rows-1` | Side by side |
| 3 | `grid-cols-2 grid-rows-2` | Index 0: `col-span-2` |
| 4 | `grid-cols-2 grid-rows-2` | Equal quadrants |
| 5 | `grid-cols-3 grid-rows-2` | Bottom-right empty |

All grid containers: `h-screen w-screen overflow-hidden`.

```css
.exam-clock {
  font-size: var(--exam-clock-size);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}
```

---

## 9. Font Size System ← NEW

### 9.1 Overview

Font sizes operate on a **two-level cascade**:

```
Global Font Scale (AppSettings.globalFontScale)
    └── Per-Timer Override (ExamTimer.fontSizeOverride)
            └── Computed Font Size (CSS variable on each card)
```

- **Global scale** is a percentage (50–200, default 100). It acts as a baseline for all timers simultaneously. Changing it affects every timer that has no override set.
- **Per-timer override** is also a percentage (50–200). When set, it replaces the global scale for that specific timer only. When `null`, the timer inherits the global scale.
- The final computed font size is derived from the base `clamp()` value multiplied by the effective scale.

### 9.2 Base Font Sizes (Before Scaling)

These are the unscaled defaults at 100% scale:

| Context | CSS Expression | Result at 1920px |
|---|---|---|
| Quiz Mode (single) | `clamp(8rem, 25vw, 22rem)` | ~480px |
| Exam Mode, 1 timer | `clamp(6rem, 20vw, 18rem)` | ~384px |
| Exam Mode, 2 timers | `clamp(4rem, 12vw, 12rem)` | ~230px |
| Exam Mode, 3–4 timers | `clamp(3rem, 9vw, 9rem)` | ~173px |
| Exam Mode, 5 timers | `clamp(2rem, 7vw, 7rem)` | ~134px |

These base values are stored in `fontSizeUtils.ts` and used to compute the CSS variable value.

### 9.3 Computed Size Formula

```typescript
// src/lib/fontSizeUtils.ts

// Base sizes per layout context
export const BASE_FONT_CLAMPS: Record<string, string> = {
  quiz:      'clamp(8rem, 25vw, 22rem)',
  exam_1:    'clamp(6rem, 20vw, 18rem)',
  exam_2:    'clamp(4rem, 12vw, 12rem)',
  exam_3_4:  'clamp(3rem, 9vw, 9rem)',
  exam_5:    'clamp(2rem, 7vw, 7rem)',
};

// Scale steps for the +/- buttons
export const SCALE_STEP = 10;   // Each click = ±10%
export const SCALE_MIN  = 50;
export const SCALE_MAX  = 200;

/**
 * Returns the effective scale for a timer.
 * Per-timer override takes precedence over global scale.
 */
export function getEffectiveScale(
  globalScale: number,
  perTimerOverride: number | null
): number {
  return perTimerOverride ?? globalScale;
}

/**
 * Given a clamp() expression and a scale percentage, returns
 * a CSS calc() expression that applies the scale factor.
 *
 * e.g. scaleClamp('clamp(4rem, 12vw, 12rem)', 120)
 *   → 'clamp(calc(4rem * 1.2), calc(12vw * 1.2), calc(12rem * 1.2))'
 */
export function scaleClamp(clampExpr: string, scalePct: number): string {
  const factor = scalePct / 100;
  return clampExpr.replace(
    /clamp\(([^,]+),\s*([^,]+),\s*([^)]+)\)/,
    (_, min, preferred, max) =>
      `clamp(calc(${min.trim()} * ${factor}), calc(${preferred.trim()} * ${factor}), calc(${max.trim()} * ${factor}))`
  );
}
```

### 9.4 Applying the Computed Size

In each `TimerCard` and `QuizTimer`, compute the CSS variable and apply it inline:

```typescript
// Inside TimerCard.tsx
const effectiveScale = getEffectiveScale(
  settings.globalFontScale,
  timer.fontSizeOverride
);

const baseClamp = getBaseClamp(timerCount); // e.g. 'clamp(3rem, 9vw, 9rem)'
const computedSize = scaleClamp(baseClamp, effectiveScale);

// Apply to the card's root element so the clock inherits it
<div
  style={{ '--exam-clock-size': computedSize } as React.CSSProperties}
  className="..."
>
  <div className="exam-clock">{formatTime(timer.remainingSeconds)}</div>
</div>
```

### 9.5 `FontSizeControl.tsx` Component

Used in both TimerCards (per-timer) and the Settings Panel (global).

```typescript
interface FontSizeControlProps {
  scale: number;              // Current effective scale (50–200)
  isOverride: boolean;        // True if this is a per-timer override (not global)
  onChange: (scale: number) => void;
  onReset?: () => void;       // Only present for per-timer controls; clears override
}
```

**Visual design:**

```
[ A−  ]  [  120%  ]  [ A+  ]  [ ↺ Reset to global ]
```

- `[A−]` decreases by `SCALE_STEP` (10%), disabled at `SCALE_MIN` (50%)
- `[A+]` increases by `SCALE_STEP` (10%), disabled at `SCALE_MAX` (200%)
- The centre shows the current scale percentage
- `[↺ Reset to global]` only appears on per-timer controls when `isOverride === true` (i.e. `fontSizeOverride !== null`). Clicking it sets `fontSizeOverride = null`, reverting to global.

**Compact variant for TimerCard** (space-constrained):

```
[A−] [A+]
```

Just the two icon buttons, no percentage label. A tooltip on hover shows the current scale and whether it is a global or per-timer value.

### 9.6 Global Font Size in Settings Panel

The Settings Panel includes a full `FontSizeControl` for the global scale. Changing this live-updates all timers that have no override — the audience sees the change in real-time on the projector without any page refresh.

```
Global Font Size
[ A−  ]  [  100%  ]  [ A+  ]
Affects all timers that have no individual override.
```

### 9.7 Per-Timer Override in Exam Mode

Each `TimerCard` shows compact `[A−]` and `[A+]` buttons in its control bar. When a per-timer override is active, a small indicator dot appears on the buttons to signal that this timer is no longer following the global setting.

**State logic:**

```typescript
// In useTimerStore.ts
const setFontSizeOverride = (id: string, scale: number | null) => {
  setTimers(prev =>
    prev.map(t => t.id === id ? { ...t, fontSizeOverride: scale } : t)
  );
};

const adjustFontSize = (id: string, delta: number, globalScale: number) => {
  const timer = timers.find(t => t.id === id);
  if (!timer) return;
  const current = timer.fontSizeOverride ?? globalScale;
  const next = Math.min(SCALE_MAX, Math.max(SCALE_MIN, current + delta));
  setFontSizeOverride(id, next);
};
```

When the user first clicks `[A+]` or `[A−]` on a timer that has `fontSizeOverride === null`, it initialises the override to `globalFontScale + delta` — so the first adjustment is always relative to the current global value, never a jarring jump.

### 9.8 Quiz Mode Font Size

In Quiz Mode, there is only one timer. The `ControlBar` includes `[A−]` and `[A+]` buttons. Since there is only one timer, it directly adjusts `globalFontScale` (no per-timer concept needed in quiz mode). This is shown clearly in the UI: label reads "Clock Size" rather than "Override".

### 9.9 Keyboard Shortcuts for Font Size

| Context | Shortcut | Action |
|---|---|---|
| Quiz Mode | `+` / `=` | Increase clock size (global) |
| Quiz Mode | `-` | Decrease clock size (global) |
| Exam Mode | `Ctrl` + hover a card, then `+` / `-` | Adjust that card's font size |

---

## 10. Visual States & Animations

### 10.1 Thresholds (Now Configurable)

Warning and critical thresholds are read from `AppSettings`, not hardcoded:

```typescript
const isWarning  = timer.remainingSeconds <= settings.warningThresholdSeconds
                   && timer.remainingSeconds > settings.criticalThresholdSeconds;
const isCritical = timer.remainingSeconds <= settings.criticalThresholdSeconds
                   && timer.remainingSeconds > 10;
const isFinal10  = timer.remainingSeconds <= 10 && timer.status === 'Running';
const isEnded    = timer.status === 'Ended';
```

### 10.2 State Table

| State | Trigger | Background | Clock Color | Animation |
|---|---|---|---|---|
| Idle | `status === 'Idle'` | `#111` | White | None |
| Running | `status === 'Running'`, no threshold met | `#111` | White | None |
| Warning | `remaining <= warningThreshold` | `#111` | Amber `#fbbf24` | Slow glow pulse |
| Critical | `remaining <= criticalThreshold` | `#1a0a0a` | Red `#f87171` | Fast glow pulse |
| Final 10 | `remaining <= 10` | `#1a0a0a` | Red | Heartbeat scale each second |
| Ended | `status === 'Ended'` | `#7f1d1d` | White | Clock blinks 1Hz |
| Dismissed | `isDismissed === true` | `#1a1a1a` | Gray | None |

### 10.3 CSS Keyframes

```css
@keyframes glow-warning {
  0%, 100% { text-shadow: 0 0 0px rgba(251, 191, 36, 0); }
  50%       { text-shadow: 0 0 40px rgba(251, 191, 36, 0.8); }
}
@keyframes glow-critical {
  0%, 100% { text-shadow: 0 0 0px rgba(248, 113, 113, 0); }
  50%       { text-shadow: 0 0 60px rgba(248, 113, 113, 1); }
}
@keyframes clock-blink {
  0%, 49%  { opacity: 1; }
  50%, 100% { opacity: 0; }
}
@keyframes count-beat {
  0%   { transform: scale(1.00); }
  20%  { transform: scale(1.07); }
  100% { transform: scale(1.00); }
}

.animate-glow-warning  { animation: glow-warning 2s ease-in-out infinite; }
.animate-glow-critical { animation: glow-critical 0.8s ease-in-out infinite; }
.animate-blink         { animation: clock-blink 1s step-end infinite; }

/* Re-trigger beat on each tick by changing the key prop */
.animate-beat { animation: count-beat 1s ease-out; }

@media (prefers-reduced-motion: reduce) {
  .animate-glow-warning, .animate-glow-critical,
  .animate-blink, .animate-beat { animation: none !important; }
}
```

---

## 11. Audio System

### 11.1 Asset & Custom Sound

Default: `src/assets/bell.mp3` (bundled, ≤ 4 seconds, loopable).

Custom sound: user selects a file via `tauri-plugin-dialog`. The absolute path is stored in `AppSettings.customAlarmPath`. `audioManager` resolves which source to use at play time.

```typescript
// src/lib/audioManager.ts
const audioInstances = new Map<string, HTMLAudioElement>();

export const audioManager = {
  play(timerId: string, customPath: string | null, volume: number): void {
    if (audioInstances.has(timerId)) return;
    const src = customPath
      ? tauri.convertFileSrc(customPath)
      : new URL('../assets/bell.mp3', import.meta.url).href;
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = volume;
    audio.play().catch(console.error);
    audioInstances.set(timerId, audio);
  },

  stop(timerId: string): void {
    const audio = audioInstances.get(timerId);
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audioInstances.delete(timerId);
  },

  stopAll(): void {
    audioInstances.forEach(a => { a.pause(); a.currentTime = 0; });
    audioInstances.clear();
  }
};
```

### 11.2 Integration

```typescript
useEffect(() => {
  if (timer.status === 'Ended' && !timer.isDismissed && settings.soundEnabled) {
    audioManager.play(timer.id, settings.customAlarmPath, settings.alarmVolume);
  } else {
    audioManager.stop(timer.id);
  }
  return () => audioManager.stop(timer.id);
}, [timer.status, timer.isDismissed, settings.soundEnabled]);
```

---

## 12. Fullscreen Presentation System

### 12.1 Requirement
True OS-level fullscreen — no taskbar, no window chrome visible.

### 12.2 Rust Command
```rust
#[tauri::command]
fn set_fullscreen(window: tauri::Window, fullscreen: bool) -> Result<(), String> {
    window.set_fullscreen(fullscreen).map_err(|e| e.to_string())
}
```

### 12.3 `useFullscreen.ts` Hook
```typescript
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const enter  = async () => { await invoke('set_fullscreen', { fullscreen: true  }); setIsFullscreen(true);  };
  const exit   = async () => { await invoke('set_fullscreen', { fullscreen: false }); setIsFullscreen(false); };
  const toggle = () => isFullscreen ? exit() : enter();

  useEffect(() => {
    const sync = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  return { isFullscreen, enter, exit, toggle };
}
```

### 12.4 Keyboard Handling
```typescript
// In QuizScreen / ExamScreen
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') exit();
    if (e.key === 'F11') { e.preventDefault(); toggle(); }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

`Escape` exits fullscreen — it does NOT stop the timer or navigate away.

### 12.5 `tauri.conf.json`
```json
{
  "app": {
    "windows": [{
      "title": "Exam & Quiz Timer",
      "width": 1280,
      "height": 720,
      "resizable": true,
      "fullscreen": false,
      "decorations": false
    }]
  }
}
```

---

## 13. Extra Time Feature ← NEW

### 13.1 Purpose
Universities commonly grant 25% or 50% additional exam time for students with accessibility accommodations. An invigilator must be able to extend a running timer without stopping it.

### 13.2 `ExtraTimeModal.tsx`

Opens when the `[+Time]` button is clicked on a running or paused timer.

```
┌──────────────────────────────────────────┐
│  Add Extra Time — GEOM 261          [✕]  │
│──────────────────────────────────────────│
│  Quick add:   [+15 min]  [+30 min]       │
│               [+45 min]  [+60 min]       │
│                                          │
│  Custom:  [____] minutes                 │
│                                          │
│              [Cancel]  [✓ Add Time]      │
└──────────────────────────────────────────┘
```

- Quick-add buttons immediately invoke `add_extra_time` and close the modal
- Custom field accepts any positive integer number of minutes
- Works on timers in any status except `Ended` and `Dismissed`
- After adding time, if the timer was `Ended`, it reverts to `Running` — the clock had hit zero but there is now time left

### 13.3 Visual Feedback

When extra time is added, briefly flash a `+N min` badge over the clock for 2 seconds so the invigilator can confirm the change was applied:

```tsx
{recentExtraTime && (
  <div className="absolute top-4 right-4 bg-green-600 text-white font-bold px-3 py-1 rounded animate-fade-out">
    +{recentExtraTime / 60} min
  </div>
)}
```

---

## 14. Blackout Mode ← NEW

### 14.1 Purpose
Before distributing exam papers or whenever the invigilator needs to prevent students from seeing the screen, one click covers the entire projected display.

### 14.2 Trigger
A `[ 🌑 Blackout ]` button in the Exam Mode toolbar (top-right, always visible). In Quiz Mode, it is accessible via the `ControlBar`.

Keyboard shortcut: `B` (when no input is focused).

### 14.3 `BlackoutScreen.tsx`

```tsx
interface BlackoutScreenProps {
  onReveal: () => void;
}

const BlackoutScreen = ({ onReveal }: BlackoutScreenProps) => (
  <div
    className="fixed inset-0 bg-black z-50 flex items-center justify-center cursor-pointer"
    onClick={onReveal}
    role="button"
    aria-label="Click to reveal timers"
  >
    {/* Nothing visible to audience. 
        Small faint hint only visible up close (invigilator's laptop): */}
    <p className="text-gray-800 text-sm select-none">
      Click anywhere to reveal
    </p>
  </div>
);
```

**Behaviour:**
- Covers the entire screen including all timer cards
- The projected screen shows only black
- Timers continue running in the background — blackout does not pause anything
- Clicking anywhere on the screen removes the blackout
- Pressing `B` again also removes the blackout
- A thin progress indicator is visible on the invigilator's mouse cursor (or a very subtle `cursor: progress` hint) to confirm time is still passing

---

## 15. Pause All / Resume All ← NEW

### 15.1 Purpose
In an emergency (fire alarm, unexpected interruption), the invigilator must be able to freeze all timers simultaneously.

### 15.2 UI

A pair of buttons in the Exam Mode top toolbar:

```
[ ⏸ Pause All ]   [ ▶ Resume All ]
```

- `[ ⏸ Pause All ]` — calls `invoke('pause_all_timers')`. Disabled if no timers are Running.
- `[ ▶ Resume All ]` — calls `invoke('resume_all_timers')`. Disabled if no timers are Paused.

Both buttons remain visible at all times (not hidden when irrelevant — just disabled) so the invigilator can find them instantly in an emergency.

### 15.3 Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `P` | Pause All (when no input focused) |
| `Shift` + `P` | Resume All |

### 15.4 Visual Confirmation

When `pause_all_timers` is called, each Running timer card briefly shows a `⏸ PAUSED` flash overlay for 1 second to confirm the action hit all timers.

---

## 16. Progress Bar ← NEW

### 16.1 Purpose
A thin visual bar showing elapsed vs. total time. Gives students a spatial/gestalt sense of how much time remains without reading digits.

### 16.2 `ProgressBar.tsx`

```typescript
interface ProgressBarProps {
  remainingSeconds: number;
  durationSeconds: number;
  status: TimerStatus;
}
```

```tsx
const ProgressBar = ({ remainingSeconds, durationSeconds, status }: ProgressBarProps) => {
  const pct = durationSeconds > 0
    ? (remainingSeconds / durationSeconds) * 100
    : 0;

  const color =
    pct <= 10  ? 'bg-red-500' :
    pct <= 25  ? 'bg-amber-400' :
                 'bg-green-500';

  return (
    <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={remainingSeconds}
        aria-valuemin={0}
        aria-valuemax={durationSeconds}
      />
    </div>
  );
};
```

### 16.3 Placement

- **Exam Mode:** Rendered below the course code header, above the clock, spanning the full card width.
- **Quiz Mode:** Rendered at the very bottom of the screen as a full-width 6px bar (`h-1.5`). Subtle; does not distract from the clock.

### 16.4 Toggle

Controlled by `AppSettings.showProgressBar`. When `false`, the bar is not rendered at all (not just hidden — no layout shift).

---

## 17. Settings Panel ← NEW

### 17.1 Overview

A slide-in panel (not a blocking modal) accessible from the Home Screen and via a small `⚙` icon in the top-right corner of Quiz/Exam screens (visible on hover or when controls are shown).

Settings are auto-saved on every change via `tauri-plugin-store`.

### 17.2 Settings Panel Layout

```
┌─────────────────────────────────────────────┐
│  ⚙ Settings                            [✕]  │
│─────────────────────────────────────────────│
│  DISPLAY                                    │
│  Global Font Size                           │
│  [ A− ]  [ 100% ]  [ A+ ]                  │
│  Affects all timers with no override        │
│                                             │
│  Show Progress Bar        [ ● ON  ]         │
│  Theme                    [ Dark ▾]         │
│─────────────────────────────────────────────│
│  WARNINGS                                   │
│  Warning threshold        [ 5 ] minutes     │
│  Critical threshold       [ 1 ] minutes     │
│  (Must be: critical < warning)              │
│─────────────────────────────────────────────│
│  AUDIO                                      │
│  Sound on timer end       [ ● ON  ]         │
│  Volume                   [━━━━●━━] 85%     │
│  Alarm sound              [ Default Bell ▾] │
│                           [ + Upload Custom ]│
│─────────────────────────────────────────────│
│  END STATE                                  │
│  Message on screen        [Time's Up — Pens Down]│
│                                             │
│─────────────────────────────────────────────│
│              [ Reset All to Defaults ]      │
└─────────────────────────────────────────────┘
```

### 17.3 Validation Rules

| Setting | Rule |
|---|---|
| Warning threshold | Must be > critical threshold. Show inline error if not. |
| Critical threshold | Must be < warning threshold and >= 1. |
| Custom alarm | File must be `.mp3`, `.wav`, or `.ogg`. Max 10MB. Play a preview on selection. |
| End message | Max 60 characters. Required (non-empty). |
| Font scale | 50–200, integer only. |

### 17.4 Custom Alarm Sound Upload

```typescript
import { open } from '@tauri-apps/plugin-dialog';

const pickAlarmFile = async () => {
  const path = await open({
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg'] }],
    multiple: false,
  });
  if (path) {
    // Play a preview
    const preview = new Audio(tauri.convertFileSrc(path as string));
    preview.volume = settings.alarmVolume;
    preview.play();
    updateSettings({ customAlarmPath: path as string });
  }
};
```

---

## 18. Voice Announcement System ← NEW

### 18.1 Overview

The voice announcement system gives the app a **spoken voice** — automatically reading out time-based announcements to students in the examination hall. This replaces the need for the invigilator to manually call out time updates.

**Three announcement types exist:**

| Type | Description | Example |
|---|---|---|
| **Threshold Announcement** | Fires automatically when a timer crosses a configured time milestone | *"Geomatic Engineering, you have 10 minutes remaining."* |
| **Scripted Message** | Invigilator pre-writes a message tied to a specific time milestone for a specific timer | *"You should place your scannables on top of your question papers now."* |
| **Ad-hoc Announcement** | Invigilator types (or selects from a quick-pick list) a message and fires it immediately | *"Quiet please — invigilators are collecting papers."* |

All three types are spoken via the same TTS engine. The LLM layer is **optional** and only used when enabled — it enhances the wording of threshold announcements to sound natural rather than robotic.

---

### 18.2 Architecture

```
                    ┌─────────────────────────────────┐
                    │       Announcement System        │
                    │                                  │
  Timer tick ──────►│  AnnouncementScheduler           │
                    │  (checks milestones each tick)   │
                    │            │                     │
  Ad-hoc trigger ──►│            ▼                     │
                    │  AnnouncementQueue               │
                    │  (serialises all speech,         │
                    │   prevents overlapping)          │
                    │            │                     │
                    │            ▼                     │
                    │  TTSEngine (abstraction layer)   │
                    │  ┌─────────────┬─────────────┐  │
                    │  │ WebSpeech   │ API (ElevenLabs│  │
                    │  │ (default,   │ / OpenAI TTS)│  │
                    │  │  offline)   │              │  │
                    │  └─────────────┴─────────────┘  │
                    │            │                     │
                    │  [Optional] LLMEnhancer          │
                    │  (rewrites text before TTS)      │
                    └─────────────────────────────────┘
```

All components live in `src/lib/announcements/`.

---

### 18.3 Data Models

Add to `src/lib/types.ts`:

```typescript
// ─── Announcement Types ───────────────────────────────────────────────

export type AnnouncementTrigger =
  | { type: 'threshold'; atSeconds: number }   // Fires when remainingSeconds crosses this value
  | { type: 'adhoc' }                          // Fired manually by invigilator

export interface Announcement {
  id: string;                      // UUID
  timerId: string | 'global';      // 'global' = not tied to a specific timer
  text: string;                    // The spoken text (may be a template — see 18.5)
  trigger: AnnouncementTrigger;
  fired: boolean;                  // True once it has been spoken (prevents re-firing)
  createdAt: number;               // Unix timestamp
}

// ─── TTS Engine Config ────────────────────────────────────────────────

export type TTSProvider = 'webspeech' | 'elevenlabs' | 'openai';

export interface TTSConfig {
  provider: TTSProvider;           // Default: 'webspeech'
  apiKey: string | null;           // Required for elevenlabs / openai
  voiceId: string | null;          // ElevenLabs voice ID, or OpenAI voice name
  rate: number;                    // Speech rate: 0.5–2.0. Default: 0.95
  pitch: number;                   // Pitch: 0.5–2.0. Default: 1.0 (WebSpeech only)
  volume: number;                  // 0–1. Default: 1.0
  // WebSpeech: name of the browser voice (e.g. "Google UK English Female")
  webSpeechVoiceName: string | null;
}

// ─── LLM Config ───────────────────────────────────────────────────────

export type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'none';

export interface LLMConfig {
  provider: LLMProvider;           // Default: 'none' (LLM enhancement disabled)
  apiKey: string | null;           // Not needed for 'ollama' or 'none'
  model: string;                   // e.g. 'gpt-4o-mini', 'claude-haiku-4-5', 'llama3.2'
  ollamaBaseUrl: string;           // Default: 'http://localhost:11434'
  enabled: boolean;                // Master on/off. Default: false
}

// ─── Threshold Milestones (Global Config) ────────────────────────────

export interface AnnouncementMilestone {
  atSeconds: number;               // e.g. 1800 = 30 min, 600 = 10 min, 300 = 5 min, 60 = 1 min
  templateText: string;            // Template with {program}, {time}, {courseCode} tokens
  enabled: boolean;
}

export const DEFAULT_MILESTONES: AnnouncementMilestone[] = [
  { atSeconds: 1800, templateText: '{program}, you have 30 minutes remaining.',  enabled: true  },
  { atSeconds: 600,  templateText: '{program}, you have 10 minutes remaining.',  enabled: true  },
  { atSeconds: 300,  templateText: '{program}, you have 5 minutes remaining.',   enabled: true  },
  { atSeconds: 60,   templateText: '{program}, you have 1 minute remaining.',    enabled: true  },
  { atSeconds: 0,    templateText: '{program}, time is up. Please stop writing.', enabled: true },
];
```

Extend `AppSettings` with:
```typescript
// Add to AppSettings interface
announcementsEnabled: boolean;     // Master switch. Default: true
ttsConfig: TTSConfig;
llmConfig: LLMConfig;
milestones: AnnouncementMilestone[];
quickPickMessages: string[];       // Invigilator-saved ad-hoc messages for re-use
```

Extend `ExamTimer` and `QuizTimer` with:
```typescript
// Add to TimerBase
scriptedAnnouncements: Announcement[];  // Per-timer custom scripted messages
```

---

### 18.4 File Structure

```
src/lib/announcements/
├── index.ts                    # Public API — re-exports everything
├── AnnouncementScheduler.ts    # Watches timer ticks, fires threshold announcements
├── AnnouncementQueue.ts        # Serialises speech; prevents overlapping
├── TTSEngine.ts                # Abstraction over WebSpeech / ElevenLabs / OpenAI
├── LLMEnhancer.ts              # Optional: rewrites template text via LLM
├── templateRenderer.ts         # Substitutes {tokens} in template strings
└── defaultMilestones.ts        # DEFAULT_MILESTONES constant
```

---

### 18.5 Template Rendering (`templateRenderer.ts`)

Announcement text supports the following tokens, replaced at fire-time:

| Token | Replaced With | Example Output |
|---|---|---|
| `{program}` | `timer.program` (Exam) or `timer.label` (Quiz) | *"Geomatic Engineering"* |
| `{courseCode}` | `timer.courseCode` | *"GEOM 261"* |
| `{time}` | Human-readable remaining time | *"10 minutes"*, *"1 minute"*, *"30 seconds"* |
| `{timeExact}` | Precise clock format | *"10:00"*, *"01:23"* |
| `{studentCount}` | `timer.studentCount` | *"45 students"* |

```typescript
// src/lib/announcements/templateRenderer.ts

export function renderTemplate(
  template: string,
  timer: AnyTimer,
  remainingSeconds: number
): string {
  const timeStr = humanReadableTime(remainingSeconds);
  const timeExact = formatTime(remainingSeconds);

  return template
    .replace('{program}',      'program' in timer ? timer.program : timer.label)
    .replace('{courseCode}',   'courseCode' in timer ? timer.courseCode : '')
    .replace('{time}',         timeStr)
    .replace('{timeExact}',    timeExact)
    .replace('{studentCount}', 'studentCount' in timer ? String(timer.studentCount) : '');
}

function humanReadableTime(seconds: number): string {
  if (seconds === 0)   return 'no time';
  if (seconds < 60)    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  if (seconds === 60)  return '1 minute';
  if (seconds < 3600)  return `${Math.round(seconds / 60)} minutes`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h} hour${h !== 1 ? 's' : ''} and ${m} minutes` : `${h} hour${h !== 1 ? 's' : ''}`;
}
```

---

### 18.6 Announcement Queue (`AnnouncementQueue.ts`)

The queue **serialises** all announcements so they never overlap — even if two timers hit the same milestone at the same tick.

```typescript
// src/lib/announcements/AnnouncementQueue.ts

type QueueItem = {
  text: string;
  priority: number;   // Higher = spoken first. Endings > warnings > scripted > adhoc
};

class AnnouncementQueue {
  private queue: QueueItem[] = [];
  private speaking = false;

  enqueue(text: string, priority = 0): void {
    this.queue.push({ text, priority });
    // Sort by priority descending so high-priority items bubble up
    this.queue.sort((a, b) => b.priority - a.priority);
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.speaking || this.queue.length === 0) return;
    this.speaking = true;
    const item = this.queue.shift()!;
    await ttsEngine.speak(item.text);
    this.speaking = false;
    this.processNext();
  }

  clear(): void {
    this.queue = [];
    ttsEngine.cancel();
    this.speaking = false;
  }
}

export const announcementQueue = new AnnouncementQueue();
```

**Priority values:**
| Announcement Type | Priority |
|---|---|
| Timer ended (`atSeconds: 0`) | 100 |
| Critical threshold (≤ 1 min) | 80 |
| Warning threshold (≤ 10 min) | 60 |
| Scripted message | 50 |
| Ad-hoc (manual) | 40 |
| Other milestones | 20 |

---

### 18.7 TTS Engine (`TTSEngine.ts`)

Abstracts over three providers. The agent must implement all three backends behind a single interface.

```typescript
// src/lib/announcements/TTSEngine.ts

interface ITTSEngine {
  speak(text: string): Promise<void>;  // Resolves when speech finishes
  cancel(): void;
  getAvailableVoices(): Promise<{ id: string; name: string; lang: string }[]>;
}
```

#### Backend A — Web Speech API (Default, Offline)

```typescript
class WebSpeechBackend implements ITTSEngine {
  async speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate   = config.ttsConfig.rate;
      utterance.pitch  = config.ttsConfig.pitch;
      utterance.volume = config.ttsConfig.volume;

      // Set preferred voice if configured
      if (config.ttsConfig.webSpeechVoiceName) {
        const voices = speechSynthesis.getVoices();
        const match = voices.find(v => v.name === config.ttsConfig.webSpeechVoiceName);
        if (match) utterance.voice = match;
      }

      utterance.onend   = () => resolve();
      utterance.onerror = (e) => reject(e);
      speechSynthesis.speak(utterance);
    });
  }

  cancel(): void { speechSynthesis.cancel(); }

  async getAvailableVoices() {
    return new Promise<{ id: string; name: string; lang: string }[]>(resolve => {
      const load = () => resolve(
        speechSynthesis.getVoices().map(v => ({ id: v.name, name: v.name, lang: v.lang }))
      );
      if (speechSynthesis.getVoices().length > 0) load();
      else speechSynthesis.addEventListener('voiceschanged', load, { once: true });
    });
  }
}
```

#### Backend B — ElevenLabs API

```typescript
class ElevenLabsBackend implements ITTSEngine {
  async speak(text: string): Promise<void> {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${config.ttsConfig.voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': config.ttsConfig.apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',    // Fastest, lowest latency
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );
    if (!response.ok) throw new Error(`ElevenLabs error: ${response.status}`);
    const blob = await response.blob();
    await playAudioBlob(blob, config.ttsConfig.volume);
  }

  cancel(): void { /* stop current HTMLAudioElement */ }

  async getAvailableVoices() {
    const r = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': config.ttsConfig.apiKey! }
    });
    const data = await r.json();
    return data.voices.map((v: any) => ({ id: v.voice_id, name: v.name, lang: 'en' }));
  }
}
```

#### Backend C — OpenAI TTS API

```typescript
class OpenAITTSBackend implements ITTSEngine {
  async speak(text: string): Promise<void> {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.ttsConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',                    // tts-1-hd for higher quality
        input: text,
        voice: config.ttsConfig.voiceId ?? 'onyx',  // alloy|echo|fable|onyx|nova|shimmer
        speed: config.ttsConfig.rate,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI TTS error: ${response.status}`);
    const blob = await response.blob();
    await playAudioBlob(blob, config.ttsConfig.volume);
  }

  cancel(): void { /* stop current HTMLAudioElement */ }

  async getAvailableVoices() {
    return [
      { id: 'alloy',   name: 'Alloy',   lang: 'en' },
      { id: 'echo',    name: 'Echo',    lang: 'en' },
      { id: 'fable',   name: 'Fable',   lang: 'en' },
      { id: 'onyx',    name: 'Onyx',    lang: 'en' },
      { id: 'nova',    name: 'Nova',    lang: 'en' },
      { id: 'shimmer', name: 'Shimmer', lang: 'en' },
    ];
  }
}
```

#### Helper: `playAudioBlob`

```typescript
function playAudioBlob(blob: Blob, volume: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = volume;
    audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onerror = reject;
    audio.play();
  });
}
```

#### Factory Function

```typescript
export function createTTSEngine(config: TTSConfig): ITTSEngine {
  switch (config.provider) {
    case 'elevenlabs': return new ElevenLabsBackend(config);
    case 'openai':     return new OpenAITTSBackend(config);
    default:           return new WebSpeechBackend(config);
  }
}
```

---

### 18.8 LLM Enhancer (`LLMEnhancer.ts`)

When `llmConfig.enabled === true`, the rendered template text is passed through the LLM **before** being enqueued for speech. The LLM's job is to make the announcement sound more natural and less robotic.

The LLM is given strict instructions to return only the announcement text — no preamble, no explanation.

```typescript
// src/lib/announcements/LLMEnhancer.ts

const SYSTEM_PROMPT = `You are an exam hall announcement assistant.
Your job is to rewrite a formal exam announcement to sound natural and clear when spoken aloud.
Rules:
- Keep the same core information (program name, time remaining)
- Use a calm, clear, authoritative tone
- Vary phrasing slightly from previous announcements so it doesn't sound like a recording
- Never add information that wasn't in the original
- Return ONLY the spoken announcement text — no quotes, no explanation
- Keep it under 25 words`;

export async function enhanceWithLLM(
  rawText: string,
  config: LLMConfig
): Promise<string> {
  if (!config.enabled || config.provider === 'none') return rawText;

  try {
    const endpoint = getEndpoint(config);
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: endpoint.headers,
      body: JSON.stringify(buildPayload(config, rawText)),
    });

    if (!response.ok) return rawText; // Silently fall back on API error

    const data = await response.json();
    return extractText(config.provider, data).trim() || rawText;

  } catch {
    return rawText; // Always fall back gracefully — never block the announcement
  }
}

function getEndpoint(config: LLMConfig): { url: string; headers: Record<string, string> } {
  switch (config.provider) {
    case 'openai':
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      };
    case 'anthropic':
      return {
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
          'x-api-key': config.apiKey!,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      };
    case 'ollama':
      return {
        url: `${config.ollamaBaseUrl}/api/chat`,
        headers: { 'Content-Type': 'application/json' },
      };
    default:
      throw new Error('No LLM endpoint for provider: ' + config.provider);
  }
}

function buildPayload(config: LLMConfig, userText: string): object {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userText },
  ];

  if (config.provider === 'anthropic') {
    return { model: config.model, max_tokens: 100, system: SYSTEM_PROMPT,
             messages: [{ role: 'user', content: userText }] };
  }
  return { model: config.model, max_tokens: 100, messages };
}

function extractText(provider: LLMProvider, data: any): string {
  if (provider === 'anthropic') return data.content?.[0]?.text ?? '';
  if (provider === 'ollama')    return data.message?.content ?? '';
  return data.choices?.[0]?.message?.content ?? ''; // OpenAI
}
```

**Fallback chain:** If the LLM call fails for any reason (network, invalid API key, timeout), the original rendered template is used. An announcement is **never** silently dropped due to LLM failure.

**Latency note:** LLM enhancement adds 200–800ms latency. The announcement fires as soon as the enhanced text is ready. For the `atSeconds: 0` (time's up) announcement, this delay is acceptable — the alarm sound fires immediately and the voice follows shortly after.

---

### 18.9 Announcement Scheduler (`AnnouncementScheduler.ts`)

Runs on every timer tick. Compares `remainingSeconds` against configured milestones and scripted announcements.

```typescript
// src/lib/announcements/AnnouncementScheduler.ts

export class AnnouncementScheduler {
  // Tracks which milestones have already fired per timer to prevent re-firing
  private fired = new Map<string, Set<number>>(); // timerId → Set<atSeconds>

  onTick(timer: AnyTimer, settings: AppSettings): void {
    if (!settings.announcementsEnabled) return;
    if (timer.status !== 'Running' && timer.status !== 'Ended') return;

    const { remainingSeconds } = timer;
    const firedForTimer = this.fired.get(timer.id) ?? new Set();

    // ── Check global milestones ──────────────────────────────────────
    for (const milestone of settings.milestones) {
      if (!milestone.enabled) continue;
      if (firedForTimer.has(milestone.atSeconds)) continue;

      // Fire if remaining time has just crossed the milestone threshold.
      // The tick runs at 500ms so we check a small window (0–1 second) to
      // avoid missing a milestone that lands between two ticks.
      if (remainingSeconds <= milestone.atSeconds && remainingSeconds >= milestone.atSeconds - 1) {
        this.fire(timer, milestone.templateText, milestone.atSeconds, settings);
        firedForTimer.add(milestone.atSeconds);
      }
    }

    // ── Check per-timer scripted announcements ───────────────────────
    for (const ann of timer.scriptedAnnouncements) {
      if (ann.fired) continue;
      if (ann.trigger.type !== 'threshold') continue;
      const { atSeconds } = ann.trigger;
      if (remainingSeconds <= atSeconds && remainingSeconds >= atSeconds - 1) {
        this.fireRaw(ann.text, 50); // Priority 50 for scripted
        ann.fired = true;
      }
    }

    this.fired.set(timer.id, firedForTimer);
  }

  private async fire(
    timer: AnyTimer,
    template: string,
    atSeconds: number,
    settings: AppSettings
  ): Promise<void> {
    const rendered = renderTemplate(template, timer, timer.remainingSeconds);
    const priority = atSeconds === 0 ? 100 : atSeconds <= 60 ? 80 : 60;

    // Optionally enhance with LLM
    const finalText = await enhanceWithLLM(rendered, settings.llmConfig);
    announcementQueue.enqueue(finalText, priority);
  }

  private fireRaw(text: string, priority: number): void {
    announcementQueue.enqueue(text, priority);
  }

  resetTimer(timerId: string): void {
    this.fired.delete(timerId); // Allow milestones to fire again if timer is reset
  }

  resetAll(): void {
    this.fired.clear();
  }
}

export const announcementScheduler = new AnnouncementScheduler();
```

**Integration in `useTimerStore.ts`:**

```typescript
// In the timer-tick event handler
const handleTick = (payload: TimerTickPayload) => {
  setTimers(prev => prev.map(t => {
    if (t.id !== payload.id) return t;
    const updated = { ...t, remainingSeconds: payload.remainingSeconds, status: payload.status };
    announcementScheduler.onTick(updated, settings); // ← hook into tick
    return updated;
  }));
};

// When a timer is reset:
const resetTimer = (id: string) => {
  invoke('reset_timer', { id });
  announcementScheduler.resetTimer(id); // Allow milestones to fire again
};
```

---

### 18.10 Ad-hoc Announcements UI

A persistent **`[ 🔊 Announce ]`** button in the Exam Mode toolbar and in the Quiz Mode `ControlBar`.

Clicking it opens the Ad-hoc Announcement panel:

```
┌──────────────────────────────────────────────────────┐
│  📢 Make an Announcement                        [✕]  │
│──────────────────────────────────────────────────────│
│  Quick pick:                                         │
│  [ Please stop writing immediately              ]    │
│  [ Place scannables on top of question papers   ]    │
│  [ Invigilators are now collecting papers       ]    │
│  [ Silence your mobile phones                   ]    │
│  [ + Add to quick pick list ]                        │
│──────────────────────────────────────────────────────│
│  Or type a custom message:                           │
│  ┌────────────────────────────────────────────────┐  │
│  │ Geomatic Engineering, please remain seated...  │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Voice: [ Onyx (OpenAI) ▾ ]    [ 🔊 Speak Now ]     │
└──────────────────────────────────────────────────────┘
```

- Quick-pick items are stored in `AppSettings.quickPickMessages` and persist between sessions
- Clicking a quick-pick item fills the text field and immediately speaks it
- `[ 🔊 Speak Now ]` enqueues the message with priority 40
- If LLM is enabled, a small `✨ Enhance` button appears next to the text field; clicking it rewrites the message before speaking
- `[ + Add to quick pick list ]` saves the current text field content to `quickPickMessages`

**Keyboard shortcut:** `A` opens the ad-hoc panel (when no input is focused).

---

### 18.11 Per-Timer Scripted Announcements

Each exam timer has a **scripted announcements editor**, accessible via a `[ 📋 Script ]` button on the timer card. This opens a modal:

```
┌──────────────────────────────────────────────────────────┐
│  📋 Scripted Announcements — GEOM 261               [✕]  │
│──────────────────────────────────────────────────────────│
│  These messages will be spoken automatically when the    │
│  timer reaches the specified time.                       │
│                                                          │
│  At remaining  │ Message                       │ Delete  │
│  ─────────────────────────────────────────────────────── │
│  5 min (300s)  │ Place scannables on top now.  │  [✕]   │
│  1 min (60s)   │ GEOM 261, one minute left.    │  [✕]   │
│                                                          │
│  + Add new scripted announcement                        │
│  At: [___] min  Message: [_______________________]  [+] │
│                                                          │
│  Tip: Use {program}, {time}, {courseCode} as tokens.    │
└──────────────────────────────────────────────────────────┘
```

- Scripted announcements fire independently of global milestones
- They are stored in `timer.scriptedAnnouncements` and do not affect other timers
- Announcements with `fired: true` are visually greyed out in the list so the invigilator can see what has already been spoken

---

### 18.12 Settings Panel — Voice & AI Section

Add a `VOICE & AI` section to the Settings Panel (Section 17):

```
VOICE & AI
──────────────────────────────────────────────────
Announcements           [ ● ON  ]

TTS Engine              [ Web Speech (offline) ▾ ]
                        [ ElevenLabs            ]
                        [ OpenAI TTS            ]

Voice                   [ Google UK English Female ▾ ]
Speech Rate             [━━━━━●━━━━] 0.95
Volume                  [━━━━━━●━━━] 100%

  [ 🔊 Test Voice ]

API Key (ElevenLabs/OpenAI)
[ sk-••••••••••••••••••••••••••••••••••• ] [Show]

──────────────────────────────────────────────────
AI Enhancement (Optional)

Make announcements sound more natural using an AI
language model instead of repeating the same phrase.

Provider  [ None (disabled) ▾ ]
          [ OpenAI            ]
          [ Anthropic         ]
          [ Ollama (local)    ]

Model     [ gpt-4o-mini ▾ ]
API Key   [ sk-•••••••••• ] [Show]

Ollama URL  [ http://localhost:11434 ]

[ Test Connection ]   → "✓ Connected"  or "✗ Failed"

──────────────────────────────────────────────────
Time Milestones

☑  30 minutes  [{program}, you have 30 minutes remaining.]  [Edit]
☑  10 minutes  [{program}, you have 10 minutes remaining.]  [Edit]
☑   5 minutes  [{program}, you have 5 minutes remaining.]   [Edit]
☑   1 minute   [{program}, you have 1 minute remaining.]    [Edit]
☑   Time's up  [{program}, time is up. Please stop writing.] [Edit]

[ + Add custom milestone ]

Available tokens: {program} {courseCode} {time} {timeExact}
```

---

### 18.13 Announcement Log

A small, collapsible log panel at the bottom of the Exam Screen (not visible to students — this is on the invigilator's control layer, only shown in windowed mode or on hover in fullscreen):

```
📢 Announcements  [▲ collapse]
────────────────────────────────────────────────
10:43:21  "Geomatic Engineering, you have 10 minutes remaining."    [↺ Repeat]
10:38:47  "Place scannables on top of question papers."             [↺ Repeat]
10:35:00  "Geomatic Engineering, you have 30 minutes remaining."    [↺ Repeat]
────────────────────────────────────────────────
```

- `[↺ Repeat]` re-enqueues the same text at priority 40
- Log persists for the current session only (not saved to disk)
- Maximum 50 entries (oldest entries are dropped)

---

### 18.14 Concurrency & Edge Cases

| Scenario | Handling |
|---|---|
| Two timers hit 10-minute milestone simultaneously | Both fire into the queue. Higher `studentCount` timer gets priority. Queue speaks them in sequence with 0.5s gap between. |
| LLM call takes > 2 seconds | The announcement is still enqueued and spoken when ready. A 5-second timeout forces fallback to the raw template text. |
| TTS API key invalid / network offline | Falls back silently to Web Speech. A small `⚠ TTS Fallback` indicator appears in the announcement log. |
| Timer reset mid-session | `announcementScheduler.resetTimer(id)` clears fired-milestone memory so they can fire again on the new countdown. |
| Blackout active when milestone fires | Audio (TTS) still plays normally — blackout is visual only. |
| Multiple ad-hoc announcements fired rapidly | All queued and spoken in order. The panel shows a queue depth indicator: `🔊 Speaking... (2 queued)`. |
| Ollama not running | `LLMEnhancer` catches the connection refused error, logs a warning to console, and returns the raw template text. The invigilator is notified once via a toast: *"Ollama connection failed — using plain announcements"*. |

---

## 19. Add Timer Modal

### Quiz Mode — `QuizSetupModal.tsx`

Fields: Label (optional, max 60 chars), Hours + Minutes (min 1 min, max 9h 59m), "Start immediately" checkbox.

### Exam Mode — `AddExamTimerModal.tsx`

| Field | Type | Validation |
|---|---|---|
| Course Code | text | Required, max 20 chars |
| Program / Cohort | text | Required, max 80 chars |
| Student Count | number | Required, integer 1–999 |
| Duration | Hours + Minutes | Min 1 min, max 9h 59m |

Global shortcut: `N` opens modal. `Escape` closes it. Add button disabled at 5 timers.

### Quiz Mode — `QuizSetupModal.tsx`

Fields: Label (optional, max 60 chars), Hours + Minutes (min 1 min, max 9h 59m), "Start immediately" checkbox.

### Exam Mode — `AddExamTimerModal.tsx`

| Field | Type | Validation |
|---|---|---|
| Course Code | text | Required, max 20 chars |
| Program / Cohort | text | Required, max 80 chars |
| Student Count | number | Required, integer 1–999 |
| Duration | Hours + Minutes | Min 1 min, max 9h 59m |

Global shortcut: `N` opens modal. `Escape` closes it. Add button disabled at 5 timers.

---

## 19. Edge Cases & Error Handling

| Scenario | Handling |
|---|---|
| Multiple timers end simultaneously | Each timer ID has its own `Audio` instance — no volume doubling |
| OS sleep / wake | `end_time_unix - now_unix()` recalculates on wake. If zero was passed during sleep, status is `Ended` on next tick |
| Negative remaining time | `u64::saturating_sub` in Rust clamps to 0 always |
| Extra time added to an Ended timer | Backend adds seconds and sets status back to `Running` |
| Custom alarm file deleted from disk | `audioManager.play()` catches the error and silently falls back to `bell.mp3` |
| Settings file corrupted on disk | `useSettings` merges saved values with `DEFAULT_SETTINGS` — missing keys fall back gracefully |
| Font scale buttons at limits | `[A−]` disabled at 50%; `[A+]` disabled at 200% |
| Blackout + timer ends during blackout | Audio still fires (sound is not blocked by blackout). Invigilator hears the alarm; reveal screen to see the end state |
| Pause All during blackout | Works correctly — blackout is a UI overlay; Rust state is unaffected |
| 6th timer attempt | Add button is `disabled`. Tooltip: "Maximum 5 simultaneous sessions reached." |

---

## 20. Accessibility & Usability

| Concern | Implementation |
|---|---|
| Contrast | All text passes WCAG AA (4.5:1). Amber on dark, white on red — verify both. |
| Progress bar | `role="progressbar"` with `aria-valuenow/min/max` |
| Font size controls | `aria-label="Decrease font size"` / `aria-label="Increase font size"` |
| Font scale tooltip | Shows `"Current: 120% (overriding global 100%)"` on hover |
| Reduced motion | All keyframe animations suppressed via `prefers-reduced-motion: reduce` |
| Focus trap | Modals and Settings Panel trap focus. Escape closes and returns focus. |
| Live region | Clock has `aria-live="off"` — announcing every second is too noisy. Status changes (Paused, Ended) are announced via a separate `aria-live="polite"` status span. |
| Keyboard nav | Full operability: Tab, Enter, Space, Escape. All icon buttons have `aria-label`. |

---

## 21. Build & Packaging

```bash
npm install
npm run tauri dev    # Development with hot reload
npm run tauri build  # Production installers
```

Additional Tauri plugin registration in `main.rs`:
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
        create_timer, start_timer, pause_timer, reset_timer, delete_timer,
        add_extra_time, pause_all_timers, resume_all_timers, set_fullscreen
    ])
    .run(tauri::generate_context!())
    .expect("error running app");
```

---

## 22. Implementation Order

### Phase 1 — Rust Foundation
1. Scaffold Tauri project, install plugins (`tauri-plugin-store`, `tauri-plugin-dialog`)
2. `TimerState` struct, `AppState` global
3. All Tauri commands (create, start, pause, reset, delete, add_extra_time, pause_all, resume_all, set_fullscreen)
4. Background tick loop
5. Manual test via browser console `invoke()`

### Phase 2 — Settings & Persistence
6. `types.ts` including `AppSettings` and `DEFAULT_SETTINGS`
7. `useSettings.ts` hook with `tauri-plugin-store`
8. `SettingsPanel.tsx` (UI only, wired to hook)
9. Custom alarm file picker

### Phase 3 — Frontend Core
10. `useTauriEvents.ts`, `useTimerStore.ts`
11. `useFullscreen.ts`, `useIdleControls.ts`, `useBlackout.ts`
12. `formatTime.ts`, `gridLayout.ts`, `audioManager.ts`
13. `fontSizeUtils.ts` — `scaleClamp()`, `getEffectiveScale()`

### Phase 4 — Quiz Mode (Build First — Simpler)
14. `HomeScreen.tsx`
15. `QuizSetupModal.tsx`
16. `QuizTimer.tsx` — giant clock, font size reads from global scale
17. `ControlBar.tsx` — idle-hide + `[A−]` `[A+]` for clock size
18. `ProgressBar.tsx` (bottom-of-screen variant)
19. `QuizScreen.tsx` wiring + fullscreen + keyboard shortcuts
20. Audio integration, final-10 heartbeat, end state

### Phase 5 — Exam Mode
21. `FontSizeControl.tsx` component
22. `TimerCard.tsx` — all states + per-timer font controls + `[+Time]` button
23. `ExtraTimeModal.tsx`
24. `DismissOverlay.tsx` with configurable `endMessage`
25. `ProgressBar.tsx` (card variant)
26. `TimerGrid.tsx` dynamic layout
27. `ExamScreen.tsx` — Pause All / Resume All toolbar + Blackout button
28. `BlackoutScreen.tsx`

### Phase 6 — Polish & QA
29. All CSS keyframe animations + `prefers-reduced-motion`
30. Accessibility audit (labels, focus, contrast, ARIA)
31. Test all 5 grid layouts at 1920×1080 and 1280×720
32. Test OS sleep/wake accuracy
33. Test simultaneous timer endings
34. Test Blackout during active/ended timers
35. Test Extra Time on running, paused, and ended timers
36. Test Settings persistence across app restarts
37. Test custom alarm with missing/deleted file (fallback)
38. `npm run tauri build` on all target OSes

---

## 23. Appendices

### Appendix A: `formatTime.ts`
```typescript
export function formatTime(totalSeconds: number, forceHours = false): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return (h > 0 || forceHours)
    ? `${String(h).padStart(2, '0')}:${mm}:${ss}`
    : `${mm}:${ss}`;
}
```

### Appendix B: `gridLayout.ts`
```typescript
export function getGridClass(count: number): string {
  const base = 'grid h-screen w-screen';
  switch (count) {
    case 1:     return `${base} grid-cols-1 grid-rows-1`;
    case 2:     return `${base} grid-cols-2 grid-rows-1`;
    case 3:
    case 4:     return `${base} grid-cols-2 grid-rows-2`;
    case 5:     return `${base} grid-cols-3 grid-rows-2`;
    default:    return `${base} grid-cols-2 grid-rows-2`;
  }
}

export function getCardSpanClass(index: number, count: number): string {
  return (count === 3 && index === 0) ? 'col-span-2' : '';
}

export function getBaseClampKey(count: number): string {
  if (count === 1) return 'exam_1';
  if (count === 2) return 'exam_2';
  if (count <= 4)  return 'exam_3_4';
  return 'exam_5';
}
```

### Appendix C: Visual State Helper
```typescript
export function getTimerVisuals(timer: AnyTimer, settings: AppSettings) {
  const { status, remainingSeconds, isDismissed } = timer;
  const { warningThresholdSeconds: warn, criticalThresholdSeconds: crit } = settings;

  if (isDismissed)               return { bg: 'bg-gray-900', clock: 'text-gray-500', anim: '' };
  if (status === 'Ended')        return { bg: 'bg-red-900',  clock: 'text-white animate-blink', anim: '' };
  if (remainingSeconds <= 10)    return { bg: 'bg-gray-900', clock: 'text-red-400', anim: 'animate-glow-critical' };
  if (remainingSeconds <= crit)  return { bg: 'bg-gray-900', clock: 'text-red-400', anim: 'animate-glow-critical' };
  if (remainingSeconds <= warn)  return { bg: 'bg-gray-900', clock: 'text-amber-400', anim: 'animate-glow-warning' };
  return                                { bg: 'bg-gray-900', clock: 'text-white', anim: '' };
}
```

### Appendix D: Complete Keyboard Shortcut Reference

| Key | Context | Action |
|---|---|---|
| `Space` | Quiz, timer running | Pause |
| `Space` | Quiz, timer paused | Resume |
| `R` | Quiz | Reset (with confirmation) |
| `B` | Quiz / Exam | Toggle Blackout |
| `P` | Exam | Pause All |
| `Shift+P` | Exam | Resume All |
| `N` | Exam | Open Add Timer modal |
| `+` / `=` | Quiz | Increase global font size |
| `-` | Quiz | Decrease global font size |
| `Escape` | Anywhere | Exit fullscreen (timer keeps running) |
| `F11` | Anywhere | Toggle fullscreen |

---

*End of Specification — v4.0*  
*Paste this entire document into your AI coding agent before creating any files.*


# 🔊 Announcement System — Specification Addendum for v4.0
## Section 18: TTS / LLM Voice Announcements

> **How to use this document:** This addendum extends the main spec (v4.0). Slot it in as **Section 18** and shift the existing sections 18–23 to 19–24. All data models, implementation order, and appendices in v4.0 remain valid — this document adds to them.

---

## Table of Contents (This Addendum)

- [18.1 Overview & Goals](#181-overview--goals)
- [18.2 Provider Architecture](#182-provider-architecture)
- [18.3 Data Models](#183-data-models)
- [18.4 Announcement Queue](#184-announcement-queue)
- [18.5 Template Variable System](#185-template-variable-system)
- [18.6 Per-Timer Announcement Schedules](#186-per-timer-announcement-schedules)
- [18.7 Global Default Schedule](#187-global-default-schedule)
- [18.8 Manual Announce Panel](#188-manual-announce-panel)
- [18.9 LLM-Generated Announcements](#189-llm-generated-announcements)
- [18.10 UI Components](#1810-ui-components)
- [18.11 Integration with Rust Tick Loop](#1811-integration-with-rust-tick-loop)
- [18.12 Settings Panel Additions](#1812-settings-panel-additions)
- [18.13 Edge Cases](#1813-edge-cases)
- [18.14 Implementation Order](#1814-implementation-order)
- [18.15 Appendix: Default Schedule & Example Messages](#1815-appendix-default-schedule--example-messages)

---

## 18.1 Overview & Goals

### What This Is
An automated voice announcement system that reads time milestone messages aloud during exams and quizzes. Announcements are triggered by the countdown timer, speak in a natural voice, and can be customised per exam session.

### Example Announcements in Practice
```
At 60 min remaining:  "Geomatic Engineering, you have one hour remaining."
At 30 min remaining:  "Geomatic Engineering, you have thirty minutes remaining.
                       You should be completing Section B by now."
At 10 min remaining:  "Geomatic Engineering, you have ten minutes remaining.
                       Please put your scannables on top of your question papers."
At  0 min remaining:  "Time is up for Geomatic Engineering.
                       Stop writing and put your pens down."
Manual (ad hoc):      "Attention all students — there is a brief interruption.
                       Please remain seated."
```

### Goals
- [ ] Announcements fire automatically at configured time milestones without invigilator action
- [ ] Message text is fully customisable per timer and per milestone
- [ ] Template variables allow one message template to work across all exam groups
- [ ] Multiple timers reaching milestones at the same time are queued — never spoken simultaneously
- [ ] Works completely offline using the Web Speech API (no API key required)
- [ ] Can be upgraded to a high-quality AI voice (OpenAI TTS, ElevenLabs) by swapping the provider in Settings
- [ ] Invigilator can trigger an ad-hoc announcement at any time with custom text
- [ ] LLM integration (optional) can generate contextual messages on demand
- [ ] Announcements can be previewed, skipped, and silenced mid-speech

---

## 18.2 Provider Architecture

The announcement system is built around a **provider interface**. The rest of the application only calls `speak()` and `stop()` — it never knows which engine is producing the audio. This makes swapping to an LLM voice a configuration change, not a code change.

### Provider Interface

```typescript
// src/lib/tts/types.ts

export interface TTSProvider {
  /**
   * Speak the given text. Returns a Promise that resolves when
   * speech has started (not when it has finished).
   */
  speak(text: string, options?: TTSSpeakOptions): Promise<void>;

  /** Immediately stop any current speech. */
  stop(): void;

  /** Returns true if this provider is available and configured. */
  isAvailable(): boolean;

  /** Human-readable name shown in Settings. */
  readonly name: string;
}

export interface TTSSpeakOptions {
  rate?: number;    // 0.5–2.0, default 0.9 (slightly slower for clarity)
  pitch?: number;   // 0.0–2.0, default 1.0
  volume?: number;  // 0.0–1.0, default 1.0
  voiceId?: string; // Provider-specific voice identifier
}
```

### Provider Implementations

Three providers ship with the app. Only one is active at a time (selected in Settings).

---

#### Provider 1: `WebSpeechTTSProvider` (Default — Offline)

Uses the browser's built-in `window.speechSynthesis` API. Available in all Tauri WebViews with no configuration required.

```typescript
// src/lib/tts/WebSpeechTTSProvider.ts

export class WebSpeechTTSProvider implements TTSProvider {
  readonly name = 'System Voice (Built-in)';

  speak(text: string, options?: TTSSpeakOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isAvailable()) return reject(new Error('Speech synthesis not available'));

      window.speechSynthesis.cancel(); // Clear any queued speech

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate   = options?.rate   ?? 0.9;
      utterance.pitch  = options?.pitch  ?? 1.0;
      utterance.volume = options?.volume ?? 1.0;

      if (options?.voiceId) {
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find(v => v.voiceURI === options.voiceId);
        if (match) utterance.voice = match;
      }

      utterance.onstart = () => resolve();
      utterance.onerror = (e) => reject(e);

      window.speechSynthesis.speak(utterance);
    });
  }

  stop(): void {
    window.speechSynthesis.cancel();
  }

  isAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /** Returns all available system voices for the Settings voice picker. */
  static getVoices(): SpeechSynthesisVoice[] {
    return window.speechSynthesis.getVoices();
  }
}
```

**Notes on system voices:**
- macOS provides high-quality voices (Samantha, Daniel, Karen, etc.)
- Windows 10/11 provides Neural voices if the language pack is installed
- Linux support varies by distro — falls back to espeak

---

#### Provider 2: `OpenAITTSProvider` (High Quality — Requires API Key)

Calls OpenAI's TTS endpoint (`tts-1` or `tts-1-hd` model). Produces natural-sounding speech. Requires internet and an API key stored in Settings.

```typescript
// src/lib/tts/OpenAITTSProvider.ts

export class OpenAITTSProvider implements TTSProvider {
  readonly name = 'OpenAI TTS';
  private apiKey: string;
  private model: 'tts-1' | 'tts-1-hd';
  private currentAudio: HTMLAudioElement | null = null;

  constructor(apiKey: string, model: 'tts-1' | 'tts-1-hd' = 'tts-1') {
    this.apiKey = apiKey;
    this.model  = model;
  }

  async speak(text: string, options?: TTSSpeakOptions): Promise<void> {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
        voice: options?.voiceId ?? 'nova',  // Options: alloy, echo, fable, onyx, nova, shimmer
        speed: options?.rate ?? 0.95,
      }),
    });

    if (!response.ok) throw new Error(`OpenAI TTS error: ${response.statusText}`);

    const blob = await response.blob();
    const url  = URL.createObjectURL(blob);
    this.currentAudio = new Audio(url);
    this.currentAudio.volume = options?.volume ?? 1.0;
    await this.currentAudio.play();
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey && navigator.onLine;
  }
}
```

**Available OpenAI voices and character:**

| Voice | Character | Best for |
|---|---|---|
| `nova` | Warm, clear, female | General announcements (recommended default) |
| `onyx` | Deep, authoritative, male | Formal exam settings |
| `alloy` | Neutral, balanced | Multilingual content |
| `shimmer` | Soft, friendly | Quiz mode / less formal |
| `echo` | Clear, professional, male | Lecture hall projection |
| `fable` | Expressive | Not recommended for exams |

---

#### Provider 3: `ElevenLabsTTSProvider` (Premium Quality — Requires API Key)

ElevenLabs produces the most natural-sounding speech available. Useful when a specific institutional voice is needed (custom voice cloning is available on paid plans).

```typescript
// src/lib/tts/ElevenLabsTTSProvider.ts

export class ElevenLabsTTSProvider implements TTSProvider {
  readonly name = 'ElevenLabs';
  private apiKey: string;
  private voiceId: string;
  private currentAudio: HTMLAudioElement | null = null;

  constructor(apiKey: string, voiceId = '21m00Tcm4TlvDq8ikWAM') { // Default: Rachel
    this.apiKey  = apiKey;
    this.voiceId = voiceId;
  }

  async speak(text: string, options?: TTSSpeakOptions): Promise<void> {
    const voiceId = options?.voiceId ?? this.voiceId;
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.8,
            speed: options?.rate ?? 0.95,
          },
        }),
      }
    );

    if (!response.ok) throw new Error(`ElevenLabs error: ${response.statusText}`);

    const blob = await response.blob();
    const url  = URL.createObjectURL(blob);
    this.currentAudio = new Audio(url);
    this.currentAudio.volume = options?.volume ?? 1.0;
    await this.currentAudio.play();
  }

  stop(): void {
    this.currentAudio?.pause();
    this.currentAudio = null;
  }

  isAvailable(): boolean {
    return !!this.apiKey && navigator.onLine;
  }
}
```

### Provider Factory

```typescript
// src/lib/tts/getTTSProvider.ts

export type TTSProviderType = 'web-speech' | 'openai' | 'elevenlabs';

export function getTTSProvider(settings: AppSettings): TTSProvider {
  switch (settings.ttsProvider) {
    case 'openai':
      if (settings.openAIApiKey) return new OpenAITTSProvider(settings.openAIApiKey, settings.openAITTSModel);
      console.warn('OpenAI TTS selected but no API key configured. Falling back to Web Speech.');
      return new WebSpeechTTSProvider();

    case 'elevenlabs':
      if (settings.elevenLabsApiKey) return new ElevenLabsTTSProvider(settings.elevenLabsApiKey, settings.elevenLabsVoiceId);
      console.warn('ElevenLabs selected but no API key configured. Falling back to Web Speech.');
      return new WebSpeechTTSProvider();

    case 'web-speech':
    default:
      return new WebSpeechTTSProvider();
  }
}
```

---

## 18.3 Data Models

### Additions to `AppSettings`

```typescript
// Add to the AppSettings interface in types.ts

export interface AppSettings {
  // ... (all existing fields from v4.0 spec) ...

  // ─── Announcements ───────────────────────────────────────────────

  announcementsEnabled: boolean;         // Master on/off. Default: true.

  // TTS Provider
  ttsProvider: TTSProviderType;          // Default: 'web-speech'
  ttsVoiceId: string | null;            // Voice URI for web-speech, or voice ID for OpenAI/ElevenLabs
  ttsRate: number;                       // Speech rate. Default: 0.9
  ttsVolume: number;                     // Volume 0–1. Default: 1.0

  // API keys (stored encrypted by tauri-plugin-store)
  openAIApiKey: string | null;           // Default: null
  openAITTSModel: 'tts-1' | 'tts-1-hd'; // Default: 'tts-1'
  elevenLabsApiKey: string | null;       // Default: null
  elevenLabsVoiceId: string | null;      // Default: null (uses ElevenLabs default)

  // LLM for message generation
  llmEnabled: boolean;                   // Default: false
  llmProvider: 'openai' | null;          // Default: null
  llmModel: string;                      // Default: 'gpt-4o-mini'

  // Global default announcement schedule
  // Applied to every new timer. Can be overridden per timer.
  defaultAnnouncementSchedule: AnnouncementEntry[];
}

// Default values to add to DEFAULT_SETTINGS:
// announcementsEnabled: true
// ttsProvider: 'web-speech'
// ttsVoiceId: null
// ttsRate: 0.9
// ttsVolume: 1.0
// openAIApiKey: null
// openAITTSModel: 'tts-1'
// elevenLabsApiKey: null
// elevenLabsVoiceId: null
// llmEnabled: false
// llmProvider: null
// llmModel: 'gpt-4o-mini'
// defaultAnnouncementSchedule: DEFAULT_ANNOUNCEMENT_SCHEDULE (see Section 18.15)
```

### `AnnouncementEntry`

A single scheduled announcement — one row in a timer's announcement schedule.

```typescript
export interface AnnouncementEntry {
  id: string;                    // UUID — used as React key and for deduplication
  triggerAtSeconds: number;      // Fire when remainingSeconds reaches this value
  message: string;               // Template string, may contain {variables}
  enabled: boolean;              // Can be toggled off without deleting the entry
  hasBeenSpoken: boolean;        // Set to true after it fires; prevents re-triggering on re-renders
}
```

### Additions to `ExamTimer` and `QuizTimer`

```typescript
// Add to TimerBase in types.ts
export interface TimerBase {
  // ... (all existing fields) ...

  announcementSchedule: AnnouncementEntry[];
  // Inherits from AppSettings.defaultAnnouncementSchedule when created.
  // Can be fully customised per timer after creation.
}
```

---

## 18.4 Announcement Queue

### Why a Queue?
If two timers reach a 10-minute milestone at the same tick, both try to speak simultaneously. This must be prevented. All announcements — from all timers — are routed through a single serial queue.

### `announcementQueue.ts`

```typescript
// src/lib/announcementQueue.ts

import { getTTSProvider } from './tts/getTTSProvider';
import type { AppSettings } from './types';

interface QueuedAnnouncement {
  id: string;              // Announcement entry ID (for deduplication)
  text: string;            // Resolved text (variables already substituted)
  priority: number;        // Lower = higher priority. 0 = manual, 1 = end-of-exam, 2 = milestone
}

class AnnouncementQueue {
  private queue: QueuedAnnouncement[] = [];
  private isSpeaking = false;
  private settings: AppSettings | null = null;

  setSettings(settings: AppSettings) {
    this.settings = settings;
  }

  enqueue(announcement: QueuedAnnouncement): void {
    // Deduplicate: don't queue the same announcement ID twice
    if (this.queue.some(a => a.id === announcement.id)) return;

    // Insert sorted by priority (lower number = front of queue)
    const idx = this.queue.findIndex(a => a.priority > announcement.priority);
    if (idx === -1) {
      this.queue.push(announcement);
    } else {
      this.queue.splice(idx, 0, announcement);
    }

    if (!this.isSpeaking) this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0 || !this.settings) {
      this.isSpeaking = false;
      return;
    }

    this.isSpeaking = true;
    const next = this.queue.shift()!;

    try {
      const provider = getTTSProvider(this.settings);
      await new Promise<void>((resolve) => {
        // We need to wait for speech to FINISH before processing next.
        // For Web Speech API, listen for 'end' event on the utterance.
        // For audio-based providers (OpenAI/ElevenLabs), listen for 'ended' on the Audio element.
        // The provider.speak() promise resolves on START, so we need a different mechanism here.
        speakAndAwaitEnd(provider, next.text, this.settings!, resolve);
      });
    } catch (err) {
      console.error('Announcement failed:', err);
    }

    // Wait 800ms between announcements for clarity
    await sleep(800);
    this.processNext();
  }

  skip(): void {
    getTTSProvider(this.settings!).stop();
    // processNext() will be called after the stop triggers the 'end' event
  }

  clear(): void {
    this.queue = [];
    getTTSProvider(this.settings!).stop();
    this.isSpeaking = false;
  }

  get pendingCount(): number {
    return this.queue.length;
  }
}

// Singleton — one queue for the entire app
export const announcementQueue = new AnnouncementQueue();

// Helper: speak and resolve when audio is fully finished
async function speakAndAwaitEnd(
  provider: TTSProvider,
  text: string,
  settings: AppSettings,
  onEnd: () => void
): Promise<void> {
  if (provider instanceof WebSpeechTTSProvider) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate   = settings.ttsRate;
    utterance.volume = settings.ttsVolume;
    // ... voice selection ...
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
    window.speechSynthesis.speak(utterance);
  } else {
    // Audio-based providers: play and wait for 'ended' event
    await provider.speak(text, { rate: settings.ttsRate, volume: settings.ttsVolume });
    // Note: for OpenAI/ElevenLabs, the audio element's 'ended' event must fire onEnd
    // This requires those providers to expose an onEnd callback — refactor speak() accordingly
    onEnd();
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
```

---

## 18.5 Template Variable System

### Available Variables

| Variable | Resolves to | Example |
|---|---|---|
| `{program}` | Full program name | `BSc Geomatic Engineering` |
| `{courseCode}` | Course code | `GEOM 261` |
| `{label}` | Timer label (quiz mode) | `Quiz 1 – Section A` |
| `{remainingMinutes}` | Whole minutes left (floor) | `10` |
| `{remainingSeconds}` | Exact seconds left | `600` |
| `{remainingWords}` | Minutes left in words | `ten minutes` |
| `{elapsedMinutes}` | Minutes elapsed (floor) | `50` |
| `{totalMinutes}` | Total exam duration in minutes | `60` |
| `{studentCount}` | Number of students | `45` |

### Variable Resolution

```typescript
// src/lib/announcements/resolveTemplate.ts

const NUMBER_WORDS: Record<number, string> = {
  1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
  6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
  15: 'fifteen', 20: 'twenty', 30: 'thirty', 45: 'forty-five',
  60: 'sixty',
};

export function resolveTemplate(
  template: string,
  timer: AnyTimer
): string {
  const remainingMins = Math.floor(timer.remainingSeconds / 60);
  const elapsedSecs   = timer.durationSeconds - timer.remainingSeconds;
  const elapsedMins   = Math.floor(elapsedSecs / 60);

  const vars: Record<string, string> = {
    program:          (timer as ExamTimer).program    ?? timer.label ?? '',
    courseCode:       (timer as ExamTimer).courseCode ?? '',
    label:            timer.label ?? '',
    remainingMinutes: String(remainingMins),
    remainingSeconds: String(timer.remainingSeconds),
    remainingWords:   NUMBER_WORDS[remainingMins] ?? `${remainingMins} minutes`,
    elapsedMinutes:   String(elapsedMins),
    totalMinutes:     String(Math.floor(timer.durationSeconds / 60)),
    studentCount:     String((timer as ExamTimer).studentCount ?? ''),
  };

  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}
```

### Template Examples

```
"Geomatic Engineering, you have {remainingWords} remaining."
→ "Geomatic Engineering, you have ten minutes remaining."

"{courseCode} — {program}. You have {remainingMinutes} minutes left.
 Please put your scannables on top of your question papers."
→ "GEOM 261 — BSc Geomatic Engineering. You have 10 minutes left.
   Please put your scannables on top of your question papers."

"Time is up for {program}. Stop writing and put your pens down."
→ "Time is up for BSc Geomatic Engineering. Stop writing and put your pens down."
```

---

## 18.6 Per-Timer Announcement Schedules

### How It Works

Each timer has an `announcementSchedule: AnnouncementEntry[]` — its own list of timed messages. When created, this list is cloned from `AppSettings.defaultAnnouncementSchedule` with the timer's `hasBeenSpoken` flags all set to `false`.

The schedule can then be edited per-timer via the **Announcement Schedule Editor** (see Section 18.10).

### Triggering Logic

This runs inside `useTimerStore.ts` whenever a `timer-tick` event is received from Rust:

```typescript
// Inside the timer-tick handler in useTimerStore.ts

const checkAndFireAnnouncements = (
  updatedTimer: AnyTimer,
  settings: AppSettings
) => {
  if (!settings.announcementsEnabled) return;
  if (updatedTimer.status !== 'Running') return;

  for (const entry of updatedTimer.announcementSchedule) {
    if (!entry.enabled) continue;
    if (entry.hasBeenSpoken) continue;

    // Fire when remaining time crosses (reaches or passes) the trigger point.
    // The tick fires every 500ms, so remainingSeconds may jump from 601 to 599.
    // Use a 3-second window to catch any ticks that land slightly past the trigger.
    const WINDOW_SECONDS = 3;
    if (updatedTimer.remainingSeconds <= entry.triggerAtSeconds &&
        updatedTimer.remainingSeconds >= entry.triggerAtSeconds - WINDOW_SECONDS) {

      const resolvedText = resolveTemplate(entry.message, updatedTimer);

      announcementQueue.enqueue({
        id: `${updatedTimer.id}-${entry.id}`,
        text: resolvedText,
        priority: entry.triggerAtSeconds === 0 ? 1 : 2,  // End-of-exam = higher priority
      });

      // Mark as spoken to prevent re-triggering
      markAnnouncementSpoken(updatedTimer.id, entry.id);
    }
  }
};
```

`markAnnouncementSpoken` updates the timer's schedule in `useTimerStore`:
```typescript
const markAnnouncementSpoken = (timerId: string, entryId: string) => {
  setTimers(prev => prev.map(t => {
    if (t.id !== timerId) return t;
    return {
      ...t,
      announcementSchedule: t.announcementSchedule.map(e =>
        e.id === entryId ? { ...e, hasBeenSpoken: true } : e
      )
    };
  }));
};
```

### Reset Behaviour
When `reset_timer` is called, set `hasBeenSpoken = false` on all entries — so if the invigilator restarts the timer, announcements fire again.

---

## 18.7 Global Default Schedule

The default schedule is stored in `AppSettings.defaultAnnouncementSchedule`. It pre-populates every new timer. Changing the global default does NOT retroactively affect timers already created in the current session.

### Factory Default Schedule

```typescript
// src/lib/announcements/defaultSchedule.ts

export const DEFAULT_ANNOUNCEMENT_SCHEDULE: AnnouncementEntry[] = [
  {
    id: 'default-60min',
    triggerAtSeconds: 3600,
    message: '{program}, you have one hour remaining.',
    enabled: true,
    hasBeenSpoken: false,
  },
  {
    id: 'default-30min',
    triggerAtSeconds: 1800,
    message: '{program}, you have thirty minutes remaining.',
    enabled: true,
    hasBeenSpoken: false,
  },
  {
    id: 'default-15min',
    triggerAtSeconds: 900,
    message: '{program}, you have fifteen minutes remaining.',
    enabled: true,
    hasBeenSpoken: false,
  },
  {
    id: 'default-10min',
    triggerAtSeconds: 600,
    message: '{program}, you have ten minutes remaining. ' +
             'Please ensure your student ID is visible on your desk.',
    enabled: true,
    hasBeenSpoken: false,
  },
  {
    id: 'default-5min',
    triggerAtSeconds: 300,
    message: '{program}, you have five minutes remaining. ' +
             'Please put your scannables on top of your question papers.',
    enabled: true,
    hasBeenSpoken: false,
  },
  {
    id: 'default-1min',
    triggerAtSeconds: 60,
    message: '{program}, you have one minute remaining.',
    enabled: true,
    hasBeenSpoken: false,
  },
  {
    id: 'default-end',
    triggerAtSeconds: 0,
    message: 'Time is up for {program}. Stop writing. Put your pens down.',
    enabled: true,
    hasBeenSpoken: false,
  },
];
```

**Note:** Entries whose `triggerAtSeconds` exceeds a timer's `durationSeconds` are silently skipped when that timer runs. E.g., a 20-minute quiz will never fire the 30-minute or 60-minute announcements.

---

## 18.8 Manual Announce Panel

### Purpose
The invigilator may need to make an ad-hoc announcement that is not on any schedule — e.g., "Please remain seated, papers are still being collected" or "There is an error on question 4 — please cross it out."

### Trigger
A `[ 📢 Announce ]` button in the Exam Mode toolbar and in the Quiz Mode `ControlBar`. Always visible.

### `ManualAnnouncePanel.tsx`

A small popover that appears above the button:

```
┌───────────────────────────────────────────────────────┐
│  📢  Manual Announcement                              │
│───────────────────────────────────────────────────────│
│  Quick:  [ All papers collected ]  [ Remain seated ]  │
│          [ Check your name ]       [ Pens down now ]  │
│                                                       │
│  Custom: [                                          ] │
│          [  Type your message here...               ] │
│                                                       │
│  Address:  ○ All timers   ● GEOM 261 only             │
│                                                       │
│                     [ ▶ Speak Now ]  [ Add to Queue ] │
└───────────────────────────────────────────────────────┘
```

**Behaviour:**
- **Quick buttons** immediately enqueue a pre-set message with `priority: 0` (front of queue — highest priority)
- **Custom text** area supports the same `{variable}` template syntax. A live preview shows the resolved text.
- **Address** selector: "All timers" appends no prefix; selecting a specific timer prepends `{courseCode}` to the message
- **Speak Now** enqueues at priority 0 — jumps to the front, interrupting nothing but playing next
- **Add to Queue** enqueues at priority 2 — waits its turn after any currently queued items
- Pressing `Enter` (with Shift+Enter for newlines) triggers "Speak Now"

### Quick Button Customisation

The 4 quick buttons are configurable in Settings. Defaults:

```typescript
export const DEFAULT_QUICK_ANNOUNCEMENTS = [
  'All papers collected.',
  'Please remain seated.',
  'Check your name is on your paper.',
  'Pens down now.',
];
```

---

## 18.9 LLM-Generated Announcements

### Purpose
When the LLM feature is enabled, the invigilator can ask for a contextually appropriate announcement to be generated rather than writing it manually. Useful for situations not covered by the default schedule.

### Use Cases
- "Generate a polite reminder that phones must be face-down"
- "Write an announcement telling students they are approximately halfway through"
- "Draft a message explaining that extra time students have 15 more minutes"

### UI

In the `ManualAnnouncePanel`, when `settings.llmEnabled === true`, an additional section appears:

```
┌───────────────────────────────────────────────────────┐
│  ✨  Generate with AI                                 │
│───────────────────────────────────────────────────────│
│  [What do you want to say?                          ] │
│  e.g. "remind students scannables go on top"          │
│                                                       │
│  Context: GEOM 261 · 10 mins remaining · 45 students  │
│                                                       │
│              [ ✨ Generate ]   (uses GPT-4o mini)     │
│                                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │ "Geomatic Engineering, please ensure your      │  │
│  │  answer sheets are placed on top of your       │  │
│  │  question papers. You have ten minutes left."  │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  [ ✎ Edit ]   [ ▶ Speak Now ]   [ 🔄 Regenerate ]    │
└───────────────────────────────────────────────────────┘
```

### LLM Call

```typescript
// src/lib/announcements/generateAnnouncement.ts

interface GenerateAnnouncementParams {
  userIntent: string;      // What the invigilator typed
  timer: AnyTimer;         // Context for variable resolution
  settings: AppSettings;
}

export async function generateAnnouncement(
  params: GenerateAnnouncementParams
): Promise<string> {
  const { userIntent, timer, settings } = params;

  const remainingMins = Math.floor(timer.remainingSeconds / 60);
  const examName = (timer as ExamTimer).program ?? timer.label ?? 'students';
  const courseCode = (timer as ExamTimer).courseCode ?? '';

  const systemPrompt = `You are generating a short, clear verbal announcement for a university exam hall. 
The announcement will be read aloud by a text-to-speech system on a projector screen in a lecture hall.

Rules:
- Address students by their program name or course code, not generically as "students"
- Keep the announcement to 1–3 sentences maximum
- Use plain spoken language — no punctuation that would sound odd when spoken (avoid brackets, slashes, etc.)
- Be calm, clear, and professional
- Do not include pleasantries or unnecessary filler
- Spell out numbers in words (e.g., "ten minutes" not "10 minutes")

Current exam context:
- Program: ${examName}
- Course Code: ${courseCode}
- Time remaining: ${remainingMins} minutes
- Student count: ${(timer as ExamTimer).studentCount ?? 'unknown'}`;

  const userMessage = `Generate an announcement for: "${userIntent}"`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.llmModel,
      messages: [
        { role: 'system',  content: systemPrompt },
        { role: 'user',    content: userMessage  },
      ],
      max_tokens: 120,
      temperature: 0.4,
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}
```

**Important:** The generated text is always shown to the invigilator for review before speaking. The system never auto-speaks LLM output without a human confirmation step.

---

## 18.10 UI Components

### `AnnouncementScheduleEditor.tsx`

Accessible from the timer card's `⋮` overflow menu → "Edit Announcements".

Displays the timer's full announcement schedule as an editable table:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Announcement Schedule — GEOM 261                              [✕]  │
│─────────────────────────────────────────────────────────────────────│
│   When          Message                                   On/Off    │
│─────────────────────────────────────────────────────────────────────│
│   60 min left   {program}, you have one hour remaining.   [ ● ]    │
│   30 min left   {program}, you have thirty minutes...     [ ● ]    │
│   10 min left   {program}, you have ten minutes...        [ ● ]    │
│    5 min left   {program}, you have five minutes...       [ ● ]    │
│    1 min left   {program}, you have one minute remaining. [ ● ]    │
│    Time's up    Time is up for {program}. Stop writing... [ ● ]    │
│─────────────────────────────────────────────────────────────────────│
│   [ + Add Entry ]                 [ Reset to Global Defaults ]      │
└─────────────────────────────────────────────────────────────────────┘
```

Each row is editable inline:
- **When:** Number input (minutes) with a small "min left" label. Converts to/from seconds internally.
- **Message:** Text area showing the template string. Below it, a "Preview" shows the resolved string using current timer values.
- **On/Off toggle:** Enables/disables without deleting.
- **Delete row:** A `✕` button on each row.
- **Drag to reorder:** Rows are drag-sortable (though order doesn't affect trigger logic — it's cosmetic for the editor).

Variable reference hint visible at the bottom:
```
Available variables: {program}  {courseCode}  {remainingMinutes}  
                     {remainingWords}  {totalMinutes}  {studentCount}
```

### `AnnouncementStatusBar.tsx`

A small persistent indicator shown in both Quiz Mode and Exam Mode when announcements are active. Appears in the bottom-right corner of the screen (below the timer cards, above the Dismiss Overlay z-index).

```
🔊 Next: "10 min warning for GEOM 261" in 4 min   [ Skip ]  [ Mute ]
```

- Shows the next scheduled announcement across all timers (the one with the smallest `triggerAtSeconds` that hasn't been spoken)
- Hides if `announcementsEnabled === false` or there are no pending announcements
- `[ Skip ]` dequeues the current item if something is currently speaking; otherwise skips the next queued item
- `[ Mute ]` temporarily disables announcements for 10 minutes (with a countdown)

### `AnnouncementToast.tsx`

When an announcement is spoken, a toast notification appears briefly on the invigilator's side (not projected to students — the screen is fullscreen but the invigilator can glance at their laptop). This confirms what was just said.

```
┌──────────────────────────────────────────────┐
│  🔊 Just announced (GEOM 261)                 │
│  "Geomatic Engineering, you have ten         │
│   minutes remaining. Please put your         │
│   scannables on top of your papers."         │
└──────────────────────────────────────────────┘
```

Auto-dismisses after 4 seconds.

---

## 18.11 Integration with Rust Tick Loop

No changes are needed to the Rust backend for basic announcement triggering. The frontend handles all announcement logic because:

1. The tick event already delivers `remainingSeconds` every 500ms
2. Template resolution, queue management, and TTS are all JavaScript concerns
3. There is no benefit to moving announcement scheduling into Rust

**However**, add this to `AppSettings` state that persists via `tauri-plugin-store` so that per-timer schedules and `hasBeenSpoken` flags survive if the app is briefly backgrounded and the WebView is refreshed.

---

## 18.12 Settings Panel Additions

Add a new **ANNOUNCEMENTS** section to the Settings Panel (Section 17):

```
─────────────────────────────────────────────
ANNOUNCEMENTS

Announcements enabled    [ ● ON  ]

Voice provider           [ System Voice (Built-in) ▾ ]
                           ○ System Voice (Built-in) — offline, no setup
                           ○ OpenAI TTS — natural AI voice
                           ○ ElevenLabs — premium AI voice

Voice                    [ Samantha (en-GB) ▾ ]
  (list populated from available voices for current provider)

Speech rate              [━━━━●━━] 0.9x
Volume                   [━━━━━●━] 100%

[ ▶ Test Voice ]   speaks: "This is a test of your announcement system."

─────────────────────────────────────────────
PROVIDER API KEYS  (only shown if non-system provider selected)

OpenAI API Key           [ sk-••••••••••••••••  ] [ 👁 ]
OpenAI TTS Model         [ tts-1 ▾ ]   ○ tts-1 (faster)  ○ tts-1-hd (better)

─────────────────────────────────────────────
AI MESSAGE GENERATION

Generate announcements with AI  [ ○ OFF ]
LLM Model                       [ gpt-4o-mini ▾ ]
(Uses the OpenAI API key above)

─────────────────────────────────────────────
DEFAULT SCHEDULE

Manage the announcement schedule that every new 
timer starts with.

[ ✎ Edit Default Schedule ]

Quick announcement buttons  (shown in manual panel)
[ All papers collected  ] [ ✎ ]
[ Please remain seated  ] [ ✎ ]
[ Check your name       ] [ ✎ ]
[ Pens down now         ] [ ✎ ]
─────────────────────────────────────────────
```

---

## 18.13 Edge Cases

| Scenario | Handling |
|---|---|
| Two timers hit 10-min milestone on same tick | Both announcements are enqueued serially. GEOM 261 (higher student count, higher priority in sort) announces first. |
| Timer is paused when milestone is reached | `checkAndFireAnnouncements` only runs when `status === 'Running'`. Paused timers do not trigger announcements. |
| Timer is reset | All `hasBeenSpoken` flags reset to `false`. Announcements will fire again if the timer is restarted. |
| Extra time added, crossing a milestone backwards | If extra time pushes `remainingSeconds` from 8 min back above 10 min, the 10-min announcement's `hasBeenSpoken` flag remains `true` and will NOT re-fire. This is intentional — re-firing would be confusing. Invigilator can manually announce if needed. |
| Internet drops mid-session with OpenAI/ElevenLabs | The `isAvailable()` check fails. `getTTSProvider()` falls back to `WebSpeechTTSProvider` and a dismissible warning toast appears: "Internet lost — switched to system voice." |
| OpenAI API key invalid or rate limited | Catch the HTTP error, show a toast, fall back to Web Speech for the remainder of the session. |
| LLM generates an inappropriate message | The generated text is always shown for review before speaking. The invigilator can edit or discard it. LLM output is never auto-spoken. |
| Announcement fires during Blackout Mode | Audio still plays (blackout is a visual overlay). The `AnnouncementToast` is visible on the invigilator's laptop (behind the blackout overlay is fine — the toast appears above it at a higher z-index on a different window area). |
| Very short exam (< 5 minutes) | Announcements whose `triggerAtSeconds > durationSeconds` are silently skipped. No errors. |
| `speechSynthesis` voices not loaded yet | Wrap voice list fetch in `speechSynthesis.onvoiceschanged` event. This is a known browser quirk — voices load asynchronously on first access. |

---

## 18.14 Implementation Order

Insert these steps into **Phase 4** of the main spec's implementation order (after the core components, before Polish & QA):

1. **`src/lib/tts/types.ts`** — `TTSProvider` interface and `TTSSpeakOptions`
2. **`WebSpeechTTSProvider.ts`** — implement and test in isolation
3. **`getTTSProvider.ts`** — provider factory with fallback logic
4. **`announcementQueue.ts`** — queue with deduplication, priority, and serial playback
5. **`resolveTemplate.ts`** — variable substitution with NUMBER_WORDS map
6. **`defaultSchedule.ts`** — factory default `AnnouncementEntry[]`
7. **Add `AnnouncementEntry[]` to timer data model** and clone on timer creation
8. **`checkAndFireAnnouncements()`** in `useTimerStore.ts` tick handler
9. **`markAnnouncementSpoken()`** in `useTimerStore.ts`
10. **Reset `hasBeenSpoken` on `reset_timer`**
11. **`AnnouncementScheduleEditor.tsx`** component
12. **`ManualAnnouncePanel.tsx`** — quick buttons + custom text
13. **`AnnouncementStatusBar.tsx`** — "next announcement" indicator
14. **`AnnouncementToast.tsx`** — confirmation of what was just spoken
15. **Settings Panel additions** — provider picker, voice selector, rate/volume, Test Voice button
16. **`OpenAITTSProvider.ts`** — implement, test with real API key
17. **Settings: API key input** with show/hide toggle
18. **`generateAnnouncement.ts`** — LLM call with system prompt
19. **LLM UI in `ManualAnnouncePanel`** — intent input, generate, review, speak
20. **`ElevenLabsTTSProvider.ts`** — implement last (lowest priority)
21. **End-to-end test:** 3-timer exam session, let all milestones fire naturally, verify queue ordering
22. **Test internet loss fallback** (disable network mid-session)

---

## 18.15 Appendix: Default Schedule & Example Messages

### Full Default Schedule

| Trigger | Default Message Template |
|---|---|
| 60 min remaining | `{program}, you have one hour remaining.` |
| 30 min remaining | `{program}, you have thirty minutes remaining.` |
| 15 min remaining | `{program}, you have fifteen minutes remaining.` |
| 10 min remaining | `{program}, you have ten minutes remaining. Please ensure your student ID is visible on your desk.` |
| 5 min remaining | `{program}, you have five minutes remaining. Please put your scannables on top of your question papers.` |
| 1 min remaining | `{program}, one minute remaining.` |
| Time's up | `Time is up for {program}. Stop writing. Put your pens down. Do not turn your papers over.` |

### Additional Message Suggestions for Quick Buttons

Invigilators can add any of these to their quick announcement buttons in Settings:

```
"Attention all students. There will be a brief interruption. Please remain seated."

"Please check that your student ID number is written clearly on every answer sheet."

"You may now begin. Good luck."

"You are now halfway through the examination."

"{courseCode} — please note that question {number} contains a correction. 
 Please listen for further instructions."

"There are currently {remainingMinutes} minutes remaining. 
 All students should be completing their final answers."

"Extra time students — you have fifteen additional minutes from this point."

"Please ensure all mobile phones are face down and silent."

"This is a reminder that you must write in blue or black ink only."

"Papers are now being collected. Please keep your answer sheets on your desk 
 and do not leave your seat until your paper has been taken."
```

---

*End of Section 18 Addendum — Announcement System*
*Slot this as Section 18 in the v4.0 spec. Shift existing sections 18–23 to 19–24.*
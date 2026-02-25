// ─── App Mode ────────────────────────────────────────────────────
export type AppMode = 'home' | 'quiz' | 'exam';
export type TimerStatus = 'Idle' | 'Running' | 'Paused' | 'Ended';

// ─── Timer Types ─────────────────────────────────────────────────
export interface TimerBase {
    id: string;
    label: string;
    durationSeconds: number;
    remainingSeconds: number;
    status: TimerStatus;
    isDismissed: boolean;
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

// ─── Tick Payload (from Rust) ────────────────────────────────────
export interface TimerTickPayload {
    id: string;
    remainingSeconds: number;
    status: TimerStatus;
}

// ─── Settings ────────────────────────────────────────────────────
export interface AppSettings {
    globalFontScale: number;
    warningThresholdSeconds: number;
    criticalThresholdSeconds: number;
    soundEnabled: boolean;
    alarmVolume: number;
    customAlarmPath: string | null;
    endMessage: string;
    showProgressBar: boolean;
    darkMode: boolean;
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

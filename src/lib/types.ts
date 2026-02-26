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
    announcementSchedule: AnnouncementEntry[];
    endTimeUnix: number | null;
}

export interface AnnouncementEntry {
    id: string;
    triggerAtSeconds: number;
    message: string;
    enabled: boolean;
    hasBeenSpoken: boolean;
}

export interface QuizTimer extends TimerBase {
    mode: 'quiz';
}

export interface ExamTimer extends TimerBase {
    mode: 'exam';
    courseCode: string;
    courseTitle?: string;
    program: string;
    studentCount: number;
}

export type AnyTimer = QuizTimer | ExamTimer;

// ─── Tick Payload (from Rust) ────────────────────────────────────
export interface TimerTickPayload {
    id: string;
    remaining_seconds: number;
    status: TimerStatus;
    end_time_unix: number | null;
}

// ─── Settings ────────────────────────────────────────────────────
export type TTSProviderType = 'web-speech' | 'custom-api';

export interface AppSettings {
    globalFontScale: number;
    warningThresholdSeconds: number;
    criticalThresholdSeconds: number;
    soundEnabled: boolean;
    alarmVolume: number;
    customAlarmPath: string | null;
    endMessage: string;
    showProgressBar: boolean;
    progressBarHeight: number;
    theme: 'system' | 'light' | 'dark';
    ignoreCompletedInCenterStage: boolean;

    // ─── Announcements ───────────────────────────────────────────────
    announcementsEnabled: boolean;
    ttsProvider: TTSProviderType;
    ttsVoiceId: string | null;
    ttsRate: number;
    ttsVolume: number;

    customTTSUrl: string;
    customTTSVoice: string | null;

    llmEnabled: boolean;
    llmProvider: 'ollama' | null;
    llmModel: string;
    ollamaUrl: string;

    defaultAnnouncementSchedule: AnnouncementEntry[];
    quickPickMessages: string[];
}

import { DEFAULT_ANNOUNCEMENT_SCHEDULE } from './announcements/defaultSchedule';

export const DEFAULT_SETTINGS: AppSettings = {
    globalFontScale: 100,
    warningThresholdSeconds: 300,
    criticalThresholdSeconds: 60,
    soundEnabled: true,
    alarmVolume: 0.85,
    customAlarmPath: null,
    endMessage: "Time's Up — Pens Down",
    showProgressBar: true,
    progressBarHeight: 20, // Default 20px
    theme: 'system',
    ignoreCompletedInCenterStage: true,

    announcementsEnabled: true,
    ttsProvider: 'web-speech',
    ttsVoiceId: null,
    ttsRate: 0.9,
    ttsVolume: 1.0,

    customTTSUrl: 'http://localhost:8000/generate',
    customTTSVoice: 'Jasper',

    llmEnabled: false,
    llmProvider: null,
    llmModel: 'llama3.1',
    ollamaUrl: 'http://localhost:11434',

    defaultAnnouncementSchedule: DEFAULT_ANNOUNCEMENT_SCHEDULE,
    quickPickMessages: [
        'All papers collected.',
        'Please remain seated.',
        'Check your name is on your paper.',
        'Pens down now.'
    ],
};

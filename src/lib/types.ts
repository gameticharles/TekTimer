// ─── App Mode ────────────────────────────────────────────────────
export type AppMode = 'home' | 'quiz' | 'exam' | 'proctor';
export type TimerStatus = 'Idle' | 'Running' | 'Paused' | 'Ended';

// ─── Timer Types ─────────────────────────────────────────────────
export interface TimerBase {
    id: string;
    groupId?: string; // Links a timer to a specific Exam Hall / Timer Group
    label: string;
    durationSeconds: number;
    remainingSeconds: number;
    status: TimerStatus;
    isDismissed: boolean;
    fontSizeOverride: number | null;
    announcementSchedule: AnnouncementEntry[];
    endTimeUnix: number | null;
    groupSession?: string;
    groupStartTime?: string;
    groupDate?: string; // YYYY-MM-DD
    groupRemark?: string;
    groupName?: string;
    attendanceSheetPath?: string;
}

export interface TimerGroup {
    id: string;
    name: string; // e.g., 'Hall B-12'
    location?: string; // e.g., 'North Campus'
    session?: string;
    scheduledStartTime?: string;
    scheduledDate?: string;
    remark?: string;
}

export interface TimerPreset {
    id: string;
    name: string; // This can now be the Venue name
    location?: string; // Optional specific room/sub-location
    capacity?: number; // Maximum student capacity
    session?: string;
    scheduledStartTime?: string;
    scheduledDate?: string;
    remark?: string;
    status: 'Idle' | 'Started' | 'Ended';
    timers: AnyTimer[]; // Configuration for timers in this preset
}

export interface Venue {
    id: string;
    name: string;
    capacity: number;
    description?: string;
}

export interface ExamLogEntry {
    id: string;
    timestamp: number;
    type: 'STARTED' | 'PAUSED' | 'WARNING' | 'ENDED' | 'ANNOUNCEMENT' | 'RESET' | 'SYSTEM' | 'INFO';
    message: string;
    itemIdentifier?: string; // Course Code or Timer Label
    timerId?: string;
    groupId?: string;
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

export interface Course {
    code: string;
    title: string;
    program: string;
    yearLevel: number;
    recommendedStudentCount?: number;
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
    savedPresets: TimerPreset[]; // Saved configurations for halls
    savedCourses: Course[]; // For auto-fill
    savedVenues: Venue[]; // Persistent hall database
    presetSortOrder: 'manual' | 'date'; // User preference for sorting presets
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
    savedPresets: [
        {
            id: 'preset-timetable-1',
            name: 'Hall OSC 1 - Session 1',
            session: 'Session 1',
            scheduledStartTime: '08:15',
            scheduledDate: '2026-02-23',
            remark: 'Level 200 Nursing - Anatomy II',
            status: 'Idle',
            timers: [{
                id: 'ptimer-t1',
                label: 'NURS 211 · Anatomy II · Nursing 2',
                durationSeconds: 3600,
                remainingSeconds: 3600,
                status: 'Idle',
                isDismissed: false,
                fontSizeOverride: null,
                endTimeUnix: null,
                mode: 'exam',
                courseCode: 'NURS 211',
                courseTitle: 'Anatomy II',
                program: 'Nursing 2',
                studentCount: 159,
                announcementSchedule: DEFAULT_ANNOUNCEMENT_SCHEDULE
            }]
        },
        {
            id: 'preset-timetable-2',
            name: 'Hall OSC 1 - Session 2 (Tue)',
            session: 'Session 2',
            scheduledStartTime: '10:00',
            scheduledDate: '2026-02-24',
            remark: 'Level 300 Nursing - Paediatric Nursing II',
            status: 'Idle',
            timers: [{
                id: 'ptimer-t2',
                label: 'NURS 355 · Paediatric Nursing II · Nursing 3',
                durationSeconds: 3600,
                remainingSeconds: 3600,
                status: 'Idle',
                isDismissed: false,
                fontSizeOverride: null,
                endTimeUnix: null,
                mode: 'exam',
                courseCode: 'NURS 355',
                courseTitle: 'Paediatric Nursing II',
                program: 'Nursing 3',
                studentCount: 76,
                announcementSchedule: DEFAULT_ANNOUNCEMENT_SCHEDULE
            }]
        },
        {
            id: 'preset-timetable-3',
            name: 'Engineering Lab - Session 1',
            session: 'Session 1',
            scheduledStartTime: '08:15',
            scheduledDate: '2026-02-25',
            remark: 'Level 100 Engineering - Technical Drawing',
            status: 'Idle',
            timers: [{
                id: 'ptimer-t3',
                label: 'ME 159 · Technical Drawing · Mech/Elec Eng 1',
                durationSeconds: 3600,
                remainingSeconds: 3600,
                status: 'Idle',
                isDismissed: false,
                fontSizeOverride: null,
                endTimeUnix: null,
                mode: 'exam',
                courseCode: 'ME 159',
                courseTitle: 'Technical Drawing',
                program: 'Mechanical Engineering 1',
                studentCount: 45,
                announcementSchedule: DEFAULT_ANNOUNCEMENT_SCHEDULE
            }]
        },
        {
            id: 'preset-timetable-4',
            name: 'Auditorium - Session 3',
            session: 'Session 3',
            scheduledStartTime: '11:45',
            scheduledDate: '2026-02-23',
            remark: 'Level 200 BBA - Financial Accounting I',
            status: 'Idle',
            timers: [{
                id: 'ptimer-t4',
                label: 'ACF 255 · Financial Accounting I · BBA 2',
                durationSeconds: 3600,
                remainingSeconds: 3600,
                status: 'Idle',
                isDismissed: false,
                fontSizeOverride: null,
                endTimeUnix: null,
                mode: 'exam',
                courseCode: 'ACF 255',
                courseTitle: 'Financial Accounting I',
                program: 'BBA 2 (Accounting)',
                studentCount: 120,
                announcementSchedule: DEFAULT_ANNOUNCEMENT_SCHEDULE
            }]
        },
        {
            id: 'preset-timetable-5',
            name: 'Hall OSC 2 - Session 1 (Thu)',
            session: 'Session 1',
            scheduledStartTime: '08:15',
            scheduledDate: '2026-02-26',
            remark: 'Level 200 Env Sci - Physical Geology',
            status: 'Idle',
            timers: [{
                id: 'ptimer-t5',
                label: 'GED 253 · Physical Geology · Environment Sci 2',
                durationSeconds: 3600,
                remainingSeconds: 3600,
                status: 'Idle',
                isDismissed: false,
                fontSizeOverride: null,
                endTimeUnix: null,
                mode: 'exam',
                courseCode: 'GED 253',
                courseTitle: 'Physical Geology',
                program: 'Environmental Science 2',
                studentCount: 38,
                announcementSchedule: DEFAULT_ANNOUNCEMENT_SCHEDULE
            }]
        },
        {
            id: 'preset-timetable-6',
            name: 'Hall HA 1 - Session 5 (Fri)',
            session: 'Session 5',
            scheduledStartTime: '03:15',
            scheduledDate: '2026-02-27',
            remark: 'Closing Session - Exam Wrap-up',
            status: 'Idle',
            timers: [{
                id: 'ptimer-t6',
                label: 'GEN 400 · Professional Ethics · All Levels',
                durationSeconds: 1800,
                remainingSeconds: 1800,
                status: 'Idle',
                isDismissed: false,
                fontSizeOverride: null,
                endTimeUnix: null,
                mode: 'exam',
                courseCode: 'GEN 400',
                courseTitle: 'Professional Ethics',
                program: 'Final Year Combined',
                studentCount: 85,
                announcementSchedule: DEFAULT_ANNOUNCEMENT_SCHEDULE
            }]
        }
    ],
    savedCourses: [
        { code: 'NURS 211', title: 'Anatomy II', program: 'Nursing 2', yearLevel: 2, recommendedStudentCount: 159 },
        { code: 'NURS 355', title: 'Paediatric Nursing II', program: 'Nursing 3', yearLevel: 3, recommendedStudentCount: 76 },
        { code: 'NURS 361', title: 'Advanced Nursing II', program: 'Nursing 3', yearLevel: 3 },
        { code: 'SMS 283', title: 'Physiology II', program: 'Nursing 2', yearLevel: 2, recommendedStudentCount: 159 },
        { code: 'MLS 365', title: 'Chem Pathology', program: 'Med Lab Tech 3', yearLevel: 3 },
        { code: 'ME 159', title: 'Technical Drawing', program: 'Engineering 1', yearLevel: 1, recommendedStudentCount: 45 },
        { code: 'MATH 351', title: 'Numerical Analysis', program: 'Engineering 3', yearLevel: 3 },
        { code: 'EE 161', title: 'Transformers', program: 'Electrical Eng 2', yearLevel: 1 },
        { code: 'CE 257', title: 'Computer Programming', program: 'Civil Eng 2', yearLevel: 2 },
        { code: 'MATH 151', title: 'Algebra', program: 'Engineering 1', yearLevel: 1, recommendedStudentCount: 43 },
        { code: 'ACF 255', title: 'Financial Accounting I', program: 'BBA 2', yearLevel: 2, recommendedStudentCount: 120 },
        { code: 'ACF 261', title: 'Business Finance', program: 'BBA 2', yearLevel: 2 },
        { code: 'ISD 357', title: 'Intro to Operation MGT', program: 'BBA 3', yearLevel: 3 },
        { code: 'GED 253', title: 'Physical Geology', program: 'Env Sci 2', yearLevel: 2, recommendedStudentCount: 38 },
        { code: 'ENVS 355', title: 'Environment and Health', program: 'Env Sci 3', yearLevel: 3 },
        { code: 'GEN 400', title: 'Professional Ethics', program: 'Final Year', yearLevel: 4, recommendedStudentCount: 85 }
    ],
    savedVenues: [
        { id: 'v-osc1', name: 'OSC 1', capacity: 350, description: 'Large Health Sciences Hall' },
        { id: 'v-osc2', name: 'OSC 2', capacity: 300, description: 'Medium Health Sciences Hall' },
        { id: 'v-osc3', name: 'OSC 3', capacity: 400, description: 'Maximum Capacity Hall' },
        { id: 'v-ha1', name: 'HA 1', capacity: 150, description: 'General Lecture Hall' },
        { id: 'v-ha2', name: 'HA 2', capacity: 180, description: 'General Lecture Hall' },
        { id: 'v-audit1', name: 'HA-AUDIT', capacity: 600, description: 'Main Auditorium' },
        { id: 'v-audit2', name: 'HA-AUDIT 2', capacity: 500, description: 'Secondary Auditorium' },
        { id: 'v-elab', name: 'E-LAB', capacity: 60, description: 'Engineering Computer Lab' }
    ],
    presetSortOrder: 'manual'
};

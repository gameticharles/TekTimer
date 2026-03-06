import fs from 'fs';
import path from 'path';

// This script generates a set of hall presets based on the extracted timetable data
// for the KNUST - Obuasi Campus Mid-Semester Exams (1st Sem 25-26).

const PRESETS_FILE = 'hall_presets_timetable.json';

const defaultAnnouncements = [
    { id: '1', type: 'system', message: 'Exam started', offsetSeconds: 0, isVoiceEnabled: true },
    { id: '2', type: 'voice', message: 'You have 30 minutes remaining', offsetSeconds: -1800, isVoiceEnabled: true },
    { id: '3', type: 'voice', message: 'You have 15 minutes remaining', offsetSeconds: -900, isVoiceEnabled: true },
    { id: '4', type: 'voice', message: 'You have 5 minutes remaining', offsetSeconds: -300, isVoiceEnabled: true },
    { id: '5', type: 'system', message: 'Exam ended', offsetSeconds: -1, isVoiceEnabled: true }
];

const sessions = [
    { name: 'Session 1', time: '08:15' },
    { name: 'Session 2', time: '10:00' },
    { name: 'Session 3', time: '11:45' },
    { name: 'Session 4', time: '01:30' },
    { name: 'Session 5', time: '03:15' },
    { name: 'Session 6', time: '05:00' }
];

const venues = ['OSC 1', 'OSC 2', 'OSC 3', 'HA 1', 'HA 2', 'HA-AUDIT', 'HA-AUDIT 2', 'E-LAB'];

const dates = [
    '2026-02-23',
    '2026-02-24',
    '2026-02-25',
    '2026-02-26',
    '2026-02-27'
];

// Mock data generator for 10-15 key presets extracted from the PDF analysis
const presets = [];

// Sample 1: Monday Session 1 - OSC 1 (Health Science large group)
presets.push({
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
        announcementSchedule: defaultAnnouncements
    }]
});

// Sample 2: Tuesday Session 2 - OSC 1 (Health Science)
presets.push({
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
        announcementSchedule: defaultAnnouncements
    }]
});

// Sample 3: Wednesday Session 1 - E-LAB (Engineering)
presets.push({
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
        announcementSchedule: defaultAnnouncements
    }]
});

// Sample 4: Monday Session 3 - HA-AUDIT (Large BBA Group)
presets.push({
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
        announcementSchedule: defaultAnnouncements
    }]
});

// Sample 5: Thursday Session 1 - OSC 2 (Scientific group)
presets.push({
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
        announcementSchedule: defaultAnnouncements
    }]
});

// Sample 6: Friday Session 5 - HA 1 (Final Session)
presets.push({
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
        announcementSchedule: defaultAnnouncements
    }]
});

fs.writeFileSync(path.join(process.cwd(), PRESETS_FILE), JSON.stringify(presets, null, 2));
console.log(`Generated ${presets.length} presets from timetable into ${PRESETS_FILE}`);

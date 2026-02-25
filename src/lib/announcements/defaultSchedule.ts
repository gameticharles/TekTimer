import type { AnnouncementEntry } from '../types';

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
        message: '{program}, you have ten minutes remaining. Please ensure your student ID is visible on your desk.',
        enabled: true,
        hasBeenSpoken: false,
    },
    {
        id: 'default-5min',
        triggerAtSeconds: 300,
        message: '{program}, you have five minutes remaining. Please put your scannables on top of your question papers.',
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
        message: 'Time is up for {program}. Stop writing. Put your pens down. Do not turn your papers over.',
        enabled: true,
        hasBeenSpoken: false,
    },
];

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { load } from '@tauri-apps/plugin-store';
import type { AnyTimer, QuizTimer, ExamTimer, TimerTickPayload, AppSettings, TimerStatus } from '../lib/types';
import { SCALE_MIN, SCALE_MAX } from '../lib/fontSizeUtils';
import { announcementQueue, resolveTemplate, enhanceWithLLM } from '../lib/announcements';

const TIMERS_STORE_PATH = 'timers.json';

export function useTimerStore(settings: AppSettings) {
    useEffect(() => {
        announcementQueue.setSettings(settings);
    }, [settings]);
    const [timers, setTimers] = useState<AnyTimer[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Initial load
    useEffect(() => {
        (async () => {
            try {
                const store = await load(TIMERS_STORE_PATH);
                const saved = await store.get<AnyTimer[]>('timers');
                if (saved && Array.isArray(saved) && saved.length > 0) {
                    await invoke('sync_timers', { timers: saved });
                    setTimers(saved);
                }
            } catch (err) {
                console.error('Failed to load timers:', err);
            } finally {
                setIsLoaded(true);
            }
        })();
    }, []);

    // Save on change (debounced)
    useEffect(() => {
        if (!isLoaded) return;
        const timeoutId = setTimeout(async () => {
            try {
                const store = await load(TIMERS_STORE_PATH);
                await store.set('timers', timers);
                await store.save();
            } catch (err) {
                console.error('Failed to save timers:', err);
            }
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [timers, isLoaded]);

    // Listen for tick events from Rust backend
    useEffect(() => {
        const unlisten = listen<TimerTickPayload>('timer-tick', (event) => {
            const payload = event.payload;
            setTimers((prev) =>
                prev.map((t) => {
                    if (t.id !== payload.id) return t;

                    const updated = {
                        ...t,
                        remainingSeconds: payload.remaining_seconds,
                        status: payload.status,
                        endTimeUnix: payload.end_time_unix,
                        announcementSchedule: [...t.announcementSchedule]
                    };

                    const justEnded = t.status === 'Running' && payload.status === 'Ended';

                    if (settings.announcementsEnabled && justEnded) {
                        const resolvedText = resolveTemplate(settings.endMessage, updated);
                        (async () => {
                            const finalText = await enhanceWithLLM(resolvedText, settings);
                            announcementQueue.enqueue({
                                id: `${updated.id}-sys-end`,
                                text: finalText,
                                priority: 1,
                            });
                        })();
                    }

                    if (settings.announcementsEnabled && updated.status === 'Running') {
                        updated.announcementSchedule = updated.announcementSchedule.map((entry) => {
                            if (!entry.enabled || entry.hasBeenSpoken) return entry;

                            const WINDOW_SECONDS = 3;
                            if (updated.remainingSeconds <= entry.triggerAtSeconds &&
                                updated.remainingSeconds >= entry.triggerAtSeconds - WINDOW_SECONDS) {

                                const resolvedText = resolveTemplate(entry.message, updated);

                                // Async fire
                                (async () => {
                                    const finalText = await enhanceWithLLM(resolvedText, settings);
                                    announcementQueue.enqueue({
                                        id: `${updated.id}-${entry.id}`,
                                        text: finalText,
                                        priority: entry.triggerAtSeconds === 0 ? 1 : 2,
                                    });
                                })();

                                return { ...entry, hasBeenSpoken: true };
                            }
                            return entry;
                        });
                    }

                    return updated;
                }),
            );
        });

        return () => {
            unlisten.then((fn) => fn());
        };
    }, [settings]);

    // ── Create Timer ──────────────────────────────────────────────────

    const createQuizTimer = useCallback(
        async (label: string, durationSeconds: number, startImmediately: boolean) => {
            const result = await invoke<{ id: string }>('create_timer', {
                durationSeconds,
                label,
            });

            const timer: QuizTimer = {
                id: result.id,
                label,
                durationSeconds,
                remainingSeconds: durationSeconds,
                status: 'Idle',
                isDismissed: false,
                fontSizeOverride: null,
                endTimeUnix: null,
                mode: 'quiz',
                announcementSchedule: settings.defaultAnnouncementSchedule.map(a => ({ ...a, id: `${a.id}-${Date.now()}` })),
            };

            setTimers([timer]);

            if (startImmediately) {
                await invoke('start_timer', { id: result.id });
                setTimers((prev) =>
                    prev.map((t) =>
                        t.id === result.id ? { ...t, status: 'Running' } : t,
                    ),
                );
            }

            return result.id;
        },
        [],
    );

    const createExamTimer = useCallback(
        async (
            courseCode: string,
            courseTitle: string | undefined,
            program: string,
            studentCount: number,
            durationSeconds: number,
        ) => {
            const label = [courseCode, courseTitle, program].filter(Boolean).join(' · ');
            const result = await invoke<{ id: string }>('create_timer', {
                durationSeconds,
                label,
            });

            const timer: ExamTimer = {
                id: result.id,
                label,
                durationSeconds,
                remainingSeconds: durationSeconds,
                status: 'Idle',
                isDismissed: false,
                fontSizeOverride: null,
                endTimeUnix: null,
                mode: 'exam',
                courseCode,
                courseTitle,
                program,
                studentCount,
                announcementSchedule: settings.defaultAnnouncementSchedule.map(a => ({ ...a, id: `${a.id}-${Date.now()}` })),
            };

            setTimers((prev) => {
                // Sort by studentCount descending
                const next = [...prev, timer];
                next.sort((a, b) => {
                    const aCount = 'studentCount' in a ? a.studentCount : 0;
                    const bCount = 'studentCount' in b ? b.studentCount : 0;
                    return bCount - aCount;
                });
                return next;
            });

        },
        [],
    );

    const updateExamTimer = useCallback(
        async (
            id: string,
            updates: { courseCode: string; courseTitle?: string; program: string; studentCount: number; durationSeconds: number }
        ) => {
            const label = [updates.courseCode, updates.courseTitle, updates.program].filter(Boolean).join(' · ');

            // Re-calculate the backend timer adjustments via new invoke command
            const result = await invoke<{ remaining_seconds: number, status: TimerStatus, end_time_unix: number | null }>('update_timer', {
                id,
                newDurationSeconds: updates.durationSeconds,
                newLabel: label
            });

            // Update local state
            setTimers((prev) =>
                prev.map((t) => {
                    if (t.id !== id || t.mode !== 'exam') return t;
                    return {
                        ...t,
                        courseCode: updates.courseCode,
                        courseTitle: updates.courseTitle,
                        program: updates.program,
                        studentCount: updates.studentCount,
                        durationSeconds: updates.durationSeconds,
                        remainingSeconds: result.remaining_seconds,
                        status: result.status,
                        endTimeUnix: result.end_time_unix,
                        label
                    };
                }),
            );
        },
        [],
    );

    const updateQuizTimer = useCallback(
        async (id: string, updates: { label: string; durationSeconds: number }) => {
            const result = await invoke<{ remaining_seconds: number; status: TimerStatus; end_time_unix: number | null }>('update_timer', {
                id,
                newDurationSeconds: updates.durationSeconds,
                newLabel: updates.label
            });

            setTimers((prev) =>
                prev.map((t) => {
                    if (t.id !== id || t.mode !== 'quiz') return t;
                    return {
                        ...t,
                        label: updates.label,
                        durationSeconds: updates.durationSeconds,
                        remainingSeconds: result.remaining_seconds,
                        status: result.status,
                        endTimeUnix: result.end_time_unix
                    };
                }),
            );
        },
        []
    );

    // ── Timer Actions ─────────────────────────────────────────────────

    const startTimer = useCallback(async (id: string) => {
        await invoke('start_timer', { id });
        setTimers((prev) =>
            prev.map((t) => (t.id === id ? { ...t, status: 'Running' as const } : t)),
        );
    }, []);

    const pauseTimer = useCallback(async (id: string) => {
        const result = await invoke<{ remaining_seconds: number }>('pause_timer', { id });
        setTimers((prev) =>
            prev.map((t) =>
                t.id === id
                    ? { ...t, status: 'Paused' as const, remainingSeconds: result.remaining_seconds }
                    : t,
            ),
        );
    }, []);

    const resetTimer = useCallback(async (id: string) => {
        await invoke('reset_timer', { id });
        setTimers((prev) =>
            prev.map((t) =>
                t.id === id
                    ? {
                        ...t,
                        status: 'Idle' as const,
                        remainingSeconds: t.durationSeconds,
                        isDismissed: false,
                        announcementSchedule: t.announcementSchedule.map(entry => ({ ...entry, hasBeenSpoken: false }))
                    }
                    : t,
            ),
        );
    }, []);

    const deleteTimer = useCallback(async (id: string) => {
        await invoke('delete_timer', { id });
        setTimers((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const reorderTimers = useCallback((sourceId: string, destId: string) => {
        setTimers((prev) => {
            const arr = [...prev];
            const sourceIndex = arr.findIndex((t) => t.id === sourceId);
            const destIndex = arr.findIndex((t) => t.id === destId);
            if (sourceIndex === -1 || destIndex === -1) return prev;

            const [moved] = arr.splice(sourceIndex, 1);
            arr.splice(destIndex, 0, moved);
            return arr;
        });
    }, []);

    const dismissTimer = useCallback((id: string) => {
        setTimers((prev) =>
            prev.map((t) => (t.id === id ? { ...t, isDismissed: true } : t)),
        );
    }, []);

    // ── Extra Time ────────────────────────────────────────────────────

    const addExtraTime = useCallback(async (id: string, extraSeconds: number) => {
        await invoke('add_extra_time', { id, extraSeconds });
        setTimers((prev) =>
            prev.map((t) => {
                if (t.id !== id) return t;
                return {
                    ...t,
                    durationSeconds: t.durationSeconds + extraSeconds,
                    remainingSeconds: t.remainingSeconds + extraSeconds,
                    status: t.status === 'Ended' ? ('Running' as const) : t.status,
                    isDismissed: false,
                };
            }),
        );
    }, []);

    // ── Pause / Resume All ────────────────────────────────────────────

    const pauseAll = useCallback(async () => {
        await invoke('pause_all_timers');
        setTimers((prev) =>
            prev.map((t) =>
                t.status === 'Running' ? { ...t, status: 'Paused' as const } : t,
            ),
        );
    }, []);

    const resumeAll = useCallback(async () => {
        await invoke('resume_all_timers');
        setTimers((prev) =>
            prev.map((t) =>
                t.status === 'Paused' ? { ...t, status: 'Running' as const } : t,
            ),
        );
    }, []);

    // ── Announcements ─────────────────────────────────────────────────

    const updateAnnouncementSchedule = useCallback((id: string, schedule: typeof settings.defaultAnnouncementSchedule) => {
        setTimers((prev) =>
            prev.map((t) => (t.id === id ? { ...t, announcementSchedule: schedule } : t)),
        );
    }, []);

    // ── Font Size ─────────────────────────────────────────────────────

    const setFontSizeOverride = useCallback((id: string, scale: number | null) => {
        setTimers((prev) =>
            prev.map((t) => (t.id === id ? { ...t, fontSizeOverride: scale } : t)),
        );
    }, []);

    const adjustFontSize = useCallback(
        (id: string, delta: number) => {
            setTimers((prev) =>
                prev.map((t) => {
                    if (t.id !== id) return t;
                    const current = t.fontSizeOverride ?? settings.globalFontScale;
                    const next = Math.min(SCALE_MAX, Math.max(SCALE_MIN, current + delta));
                    return { ...t, fontSizeOverride: next };
                }),
            );
        },
        [settings.globalFontScale],
    );

    // ── Clear All ─────────────────────────────────────────────────────

    const clearAll = useCallback(async () => {
        for (const t of timers) {
            try {
                await invoke('delete_timer', { id: t.id });
            } catch {
                // Timer may have already been removed
            }
        }
        setTimers([]);
    }, [timers]);

    return {
        timers,
        createQuizTimer,
        createExamTimer,
        updateExamTimer,
        updateQuizTimer,
        startTimer,
        pauseTimer,
        resetTimer,
        deleteTimer,
        reorderTimers,
        dismissTimer,
        addExtraTime,
        pauseAll,
        resumeAll,
        setFontSizeOverride,
        adjustFontSize,
        clearAll,
        updateAnnouncementSchedule,
    };
}

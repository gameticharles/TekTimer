import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { load } from '@tauri-apps/plugin-store';
import type { AnyTimer, QuizTimer, ExamTimer, TimerTickPayload, AppSettings, TimerStatus, ExamLogEntry } from '../lib/types';
import { SCALE_MIN, SCALE_MAX } from '../lib/fontSizeUtils';
import { announcementQueue, resolveTemplate, enhanceWithLLM } from '../lib/announcements';
import { audioManager } from '../lib/audioManager';

const TIMERS_STORE_PATH = 'timers.json';

export function useTimerStore(settings: AppSettings, onLog?: (type: ExamLogEntry['type'], message: string, itemIdentifier?: string, timerId?: string, groupId?: string) => void) {
    const getTimerDisplayName = (t: AnyTimer) => {
        return t.mode === 'exam' ? t.courseCode : t.label;
    };
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
                    const justEnteredWarning = t.remainingSeconds > settings.warningThresholdSeconds && payload.remaining_seconds <= settings.warningThresholdSeconds && payload.status === 'Running';

                    if (justEnded) {
                        onLog?.('ENDED', `${getTimerDisplayName(t)}: Time up`, getTimerDisplayName(t), t.id, t.groupId);
                    }

                    if (justEnteredWarning) {
                        onLog?.('WARNING', `${getTimerDisplayName(t)}: Entered warning period`, getTimerDisplayName(t), t.id, t.groupId);
                    }

                    // 5-second countdown beeps
                    if (settings.soundEnabled && payload.status === 'Running' && payload.remaining_seconds <= 5 && payload.remaining_seconds > 0) {
                        if (t.remainingSeconds !== payload.remaining_seconds) {
                            audioManager.playBeep(payload.remaining_seconds, settings.alarmVolume);
                        }
                    }

                    if (settings.announcementsEnabled && justEnded) {
                        const resolvedText = resolveTemplate(settings.endMessage, updated);
                        (async () => {
                            const finalText = await enhanceWithLLM(resolvedText, settings);
                            announcementQueue.enqueue({
                                id: `${updated.id}-sys-end`,
                                text: finalText,
                                priority: 1,
                            });
                            // Log the final announcement text
                            onLog?.('ANNOUNCEMENT', `${getTimerDisplayName(updated)} Final: ${finalText}`, getTimerDisplayName(updated), updated.id, updated.groupId);
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
                                    onLog?.('ANNOUNCEMENT', `${getTimerDisplayName(updated)}: ${finalText}`, getTimerDisplayName(updated), updated.id, updated.groupId);
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
        async (label: string, durationSeconds: number, startImmediately: boolean, groupId?: string) => {
            const result = await invoke<{ id: string }>('create_timer', {
                durationSeconds,
                label,
            });

            const timer: QuizTimer = {
                id: result.id,
                groupId,
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

            setTimers((prev) => [...prev, timer]);

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
            groupId?: string
        ) => {
            const label = [courseCode, courseTitle, program].filter(Boolean).join(' · ');
            const result = await invoke<{ id: string }>('create_timer', {
                durationSeconds,
                label,
            });

            const timer: ExamTimer = {
                id: result.id,
                groupId,
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

    const createGroupFromPreset = useCallback(async (preset: import('../lib/types').TimerPreset, startImmediately: boolean = false) => {
        const groupId = `group-${Date.now()}`;
        const newTimers: import('../lib/types').AnyTimer[] = [];

        for (const pt of preset.timers) {
            const result = await invoke<{ id: string }>('create_timer', {
                durationSeconds: pt.durationSeconds,
                label: pt.label,
            });

            newTimers.push({
                ...pt,
                id: result.id,
                groupId,
                groupSession: preset.session,
                groupStartTime: preset.scheduledStartTime,
                groupRemark: preset.remark,
                groupName: preset.name,
                status: 'Idle',
                remainingSeconds: pt.durationSeconds,
                endTimeUnix: null,
                isDismissed: false,
                hasBeenSpoken: false
            } as any);
        }

        setTimers((prev) => [...prev, ...newTimers]);

        if (startImmediately) {
            for (const nt of newTimers) {
                await invoke('start_timer', { id: nt.id });
            }
            setTimers(prev => prev.map(t => newTimers.find(nt => nt.id === t.id) ? { ...t, status: 'Running' } : t));
        }

        onLog?.('SYSTEM', `Administrator loaded preset ${preset.name}`, preset.name, undefined, groupId);
        return groupId;
    }, [onLog, settings]);

    // ── Timer Actions ─────────────────────────────────────────────────

    const startTimer = useCallback(async (id: string) => {
        const timer = timers.find(t => t.id === id);
        await invoke('start_timer', { id });
        setTimers((prev) =>
            prev.map((t) => (t.id === id ? { ...t, status: 'Running' as const } : t)),
        );
        if (timer) {
            onLog?.('STARTED', `${getTimerDisplayName(timer)}: Started`, getTimerDisplayName(timer), timer.id, timer.groupId);
        }
    }, [timers, onLog]);

    const pauseTimer = useCallback(async (id: string) => {
        const timer = timers.find(t => t.id === id);
        const result = await invoke<{ remaining_seconds: number }>('pause_timer', { id });
        setTimers((prev) =>
            prev.map((t) =>
                t.id === id
                    ? { ...t, status: 'Paused' as const, remainingSeconds: result.remaining_seconds }
                    : t,
            ),
        );
        if (timer) {
            onLog?.('PAUSED', `${getTimerDisplayName(timer)}: Paused`, getTimerDisplayName(timer), timer.id, timer.groupId);
        }
    }, [timers, onLog]);

    const resetTimer = useCallback(async (id: string) => {
        const timer = timers.find(t => t.id === id);
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
        if (timer) {
            onLog?.('RESET', `${getTimerDisplayName(timer)}: Reset`, getTimerDisplayName(timer), timer.id, timer.groupId);
        }
    }, [timers, onLog]);

    const deleteTimer = useCallback(async (id: string) => {
        const timer = timers.find(t => t.id === id);
        await invoke('delete_timer', { id });
        if (timer) {
            onLog?.('SYSTEM', `Deleted Timer: ${getTimerDisplayName(timer)}`, getTimerDisplayName(timer), undefined, timer.groupId);
        }
        setTimers((prev) => prev.filter((t) => t.id !== id));
    }, [timers, onLog]);

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
        const timer = timers.find(t => t.id === id);
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
        if (timer) {
            onLog?.('SYSTEM', `Added ${Math.floor(extraSeconds / 60)}m to Timer: ${getTimerDisplayName(timer)}`, getTimerDisplayName(timer), timer.id, timer.groupId);
        }
    }, [timers, onLog]);

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

    // ── Group Actions ─────────────────────────────────────────────────

    const startGroup = useCallback(async (groupId: string) => {
        const groupTimers = timers.filter(t => t.groupId === groupId && t.status !== 'Running' && t.status !== 'Ended');
        for (const t of groupTimers) {
            await invoke('start_timer', { id: t.id });
        }
        setTimers((prev) =>
            prev.map((t) => (t.groupId === groupId && t.status !== 'Running' && t.status !== 'Ended' ? { ...t, status: 'Running' as const } : t)),
        );
        onLog?.('STARTED', `Started Hall Session`, undefined, groupId);
    }, [timers, onLog]);

    const pauseGroup = useCallback(async (groupId: string) => {
        const groupTimers = timers.filter(t => t.groupId === groupId && t.status === 'Running');
        for (const t of groupTimers) {
            const result = await invoke<{ remaining_seconds: number }>('pause_timer', { id: t.id });
            setTimers((prev) =>
                prev.map((pt) =>
                    pt.id === t.id
                        ? { ...pt, status: 'Paused' as const, remainingSeconds: result.remaining_seconds }
                        : pt,
                ),
            );
        }
        onLog?.('PAUSED', `Paused Hall Session`, undefined, groupId);
    }, [timers, onLog]);

    const addExtraTimeGroup = useCallback(async (groupId: string, extraSeconds: number) => {
        const groupTimers = timers.filter(t => t.groupId === groupId);
        for (const t of groupTimers) {
            await invoke('add_extra_time', { id: t.id, extraSeconds });
        }
        setTimers((prev) =>
            prev.map((t) => {
                if (t.groupId !== groupId) return t;
                return {
                    ...t,
                    durationSeconds: t.durationSeconds + extraSeconds,
                    remainingSeconds: t.remainingSeconds + extraSeconds,
                    status: t.status === 'Ended' ? ('Running' as const) : t.status,
                    isDismissed: false,
                };
            }),
        );
        onLog?.('SYSTEM', `Added ${Math.floor(extraSeconds / 60)}m to Hall Session`, undefined, groupId);
    }, [timers, onLog]);

    const removeGroup = useCallback(async (groupId: string) => {
        const groupTimers = timers.filter(t => t.groupId === groupId);
        for (const t of groupTimers) {
            await invoke('delete_timer', { id: t.id });
        }
        onLog?.('SYSTEM', `Removed Hall from monitoring`, undefined, groupId);
        setTimers((prev) => prev.filter(t => t.groupId !== groupId));
    }, [timers, onLog]);

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
        createGroupFromPreset,
        startTimer,
        pauseTimer,
        resetTimer,
        deleteTimer,
        reorderTimers,
        dismissTimer,
        addExtraTime,
        pauseAll,
        resumeAll,
        startGroup,
        pauseGroup,
        addExtraTimeGroup,
        removeGroup,
        setFontSizeOverride,
        adjustFontSize,
        clearAll,
        updateAnnouncementSchedule,
    };
}

export type TimerStore = ReturnType<typeof useTimerStore>;

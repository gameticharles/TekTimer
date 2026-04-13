import { useState, useEffect, useCallback, useRef } from 'react';
import React from 'react';
import {
    Plus, Pause, Play, Moon, Settings, Maximize, Minimize, ArrowLeft, LayoutGrid,
    Presentation, Mic, Power, ArrowLeftRight
} from 'lucide-react';
import TimerCard, { type TimerCardHandle } from '../components/TimerCard';
import AddExamTimerModal from '../components/AddExamTimerModal';
import EditExamTimerModal from '../components/EditExamTimerModal';
import ExtraTimeModal from '../components/ExtraTimeModal';
import EmptyState from '../components/EmptyState';
import BlackoutScreen from '../components/BlackoutScreen';
import CenterStageView from '../components/CenterStageView';
import AnnouncementModal from '../components/AnnouncementModal';
import type { AppSettings, ExamTimer } from '../lib/types';
import type { TimerStore } from '../hooks/useTimerStore';
import { useFullscreen } from '../hooks/useFullscreen';
import { useBlackout } from '../hooks/useBlackout';
import { useIdleControls } from '../hooks/useIdleControls';
import { audioManager } from '../lib/audioManager';
import { getGridClass, getCardSpanClass } from '../lib/gridLayout';
import { SCALE_STEP, SCALE_MIN, SCALE_MAX } from '../lib/fontSizeUtils';

// ── 2-timer layout variants ──────────────────────────────────────────────────
type TwoTimerMode = 'side-by-side' | 'stacked' | 'primary-secondary';

// Inline SVG icons for the three layout modes (no extra dependencies)
const LayoutIconSideBySide = () => (
    <svg viewBox="0 0 20 14" fill="currentColor" width="18" height="13">
        <rect x="0" y="0" width="9" height="14" rx="1.5" />
        <rect x="11" y="0" width="9" height="14" rx="1.5" />
    </svg>
);
const LayoutIconStacked = () => (
    <svg viewBox="0 0 20 14" fill="currentColor" width="18" height="13">
        <rect x="0" y="0" width="20" height="6" rx="1.5" />
        <rect x="0" y="8" width="20" height="6" rx="1.5" />
    </svg>
);
const LayoutIconPrimarySecondary = () => (
    <svg viewBox="0 0 20 14" fill="currentColor" width="18" height="13">
        <rect x="0" y="0" width="12" height="14" rx="1.5" />
        <rect x="14" y="0" width="6" height="14" rx="1.5" />
    </svg>
);

interface ExamScreenProps {
    settings: AppSettings;
    onUpdateSettings: (patch: Partial<AppSettings>) => void;
    onExit: () => void;
    onSettings: () => void;
    groupId?: string;
    store: TimerStore;
}

export default function ExamScreen({ settings, onUpdateSettings, onExit, onSettings, groupId, store }: ExamScreenProps) {
    const [showAddModal, setShowAddModal] = useState(false);
    const [editTimerId, setEditTimerId] = useState<string | null>(null);
    const [extraTimeTimerId, setExtraTimeTimerId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'center'>('grid');
    const [showAnnounceModal, setShowAnnounceModal] = useState(false);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    /** 1-based index of the card selected for font / start-pause keyboard control. */
    const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
    /** Refs to each TimerCard's imperative handle, indexed 0-4 (up to 5 cards). */
    const cardRefs = useRef<Array<TimerCardHandle | null>>([null, null, null, null, null]);
    /** Layout mode for 2-timer display. */
    const [twoTimerMode, setTwoTimerMode] = useState<TwoTimerMode>('side-by-side');
    /** Manually pinned primary timer id; null = auto (picks the one with less time remaining). */
    const [primaryTimerId, setPrimaryTimerId] = useState<string | null>(null);
    // Pointer-event drag tracking ref (synchronous; never stale in listeners)
    const dragRef = useRef<{
        sourceId: string;
        pointerId: number;
        startX: number;
        startY: number;
        active: boolean;
    } | null>(null);
    const { isFullscreen, toggle: toggleFullscreen, exit: exitFullscreen } = useFullscreen();
    const { isBlackout, enableBlackout, disableBlackout } = useBlackout();
    const { controlsVisible } = useIdleControls();

    // Filter timers: only exam-mode timers, optionally filtered by groupId
    const examTimers = groupId
        ? (store.timers.filter(t => t.groupId === groupId && t.mode === 'exam') as ExamTimer[])
        : (store.timers.filter(t => t.mode === 'exam') as ExamTimer[]);
    const hasRunning = examTimers.some((t) => t.status === 'Running');
    const hasPaused = examTimers.some((t) => t.status === 'Paused');

    // ── 2-timer layout derived state ──────────────────────────────────────
    // Auto-primary = timer with the least remaining time (most urgent)
    const effectivePrimaryId = examTimers.length === 2
        ? (primaryTimerId && examTimers.some(t => t.id === primaryTimerId)
            ? primaryTimerId
            : [...examTimers].sort((a, b) => a.remainingSeconds - b.remainingSeconds)[0]?.id ?? null)
        : null;

    // In primary-secondary mode: put primary card first so it occupies the larger column
    const orderedTimers = (twoTimerMode === 'primary-secondary' && examTimers.length === 2 && effectivePrimaryId)
        ? [...examTimers].sort(a => a.id === effectivePrimaryId ? -1 : 1)
        : examTimers;

    // Grid container class + style — custom handling for 2-timer layouts
    const gridConfig = (() => {
        const base = 'grid h-screen w-screen gap-4 p-4 pt-24 pb-20';
        if (examTimers.length === 2) {
            switch (twoTimerMode) {
                case 'side-by-side':
                    return { className: `${base} grid-cols-2 grid-rows-1`, style: {} as React.CSSProperties };
                case 'stacked':
                    return { className: `${base} grid-cols-1 grid-rows-2`, style: {} as React.CSSProperties };
                case 'primary-secondary':
                    return { className: `${base} grid-rows-1`, style: { gridTemplateColumns: '3fr 2fr' } as React.CSSProperties };
            }
        }
        return {
            className: getGridClass(examTimers.length) + ' gap-4 p-4 pt-24 pb-20',
            style: {} as React.CSSProperties,
        };
    })();

    // Audio integration for all timers
    useEffect(() => {
        for (const timer of examTimers) {
            if (timer.status === 'Ended' && !timer.isDismissed && settings.soundEnabled) {
                audioManager.play(timer.id, settings.customAlarmPath, settings.alarmVolume);
            } else {
                audioManager.stop(timer.id);
            }
        }
        return () => audioManager.stopAll();
    }, [examTimers.map((t) => `${t.id}-${t.status}-${t.isDismissed}`).join(',')]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
            ) return;

            if (e.key === 'Escape') { exitFullscreen(); setActiveCardIndex(null); return; }
            if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); return; }
            if (e.key === 'n' || e.key === 'N') {
                if (examTimers.length < 5) setShowAddModal(true);
                return;
            }
            if (e.key === 'p' && !e.shiftKey) { store.pauseAll(); return; }
            if (e.key === 'P' && e.shiftKey) { store.resumeAll(); return; }
            if (e.key === 'v' || e.key === 'V') {
                setViewMode((prev) => (prev === 'grid' ? 'center' : 'grid'));
                return;
            }

            // ── Per-card focus shortcuts (digit keys 0-9) ──────────────────
            const digitMatch = e.key.match(/^([0-9])$/);
            if (digitMatch) {
                const digit = parseInt(digitMatch[1]);
                if (digit === 0 || !examTimers[digit - 1]) {
                    // 0 or digit beyond card count — clear focus
                    setActiveCardIndex(null);
                } else {
                    setActiveCardIndex(digit);
                }
                return;
            }

            // ── Space / Enter: start/pause the focused card ─────────────
            if (e.key === ' ' || e.key === 'Enter') {
                if (activeCardIndex == null) return;
                const target = examTimers[activeCardIndex - 1];
                if (!target) return;
                e.preventDefault();
                if (target.status === 'Running') store.pauseTimer(target.id);
                else if (target.status === 'Idle' || target.status === 'Paused') store.startTimer(target.id);
                return;
            }

            // ── Font size control for the active card ([ and ]) ────────
            if (e.key === '[' || e.key === ']') {
                e.preventDefault();
                const idx = activeCardIndex != null ? activeCardIndex - 1 : null;
                if (idx == null || !examTimers[idx]) return;
                const target = examTimers[idx];
                const current = target.fontSizeOverride ?? settings.globalFontScale;
                const next = e.key === ']'
                    ? Math.min(SCALE_MAX, current + SCALE_STEP)
                    : Math.max(SCALE_MIN, current - SCALE_STEP);
                store.setFontSizeOverride(target.id, next);
                return;
            }

            // ── Dot key: fit-to-container for the active card ─────────────
            if (e.key === '.') {
                if (activeCardIndex == null) return;
                e.preventDefault();
                cardRefs.current[activeCardIndex - 1]?.triggerFit();
                return;
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [examTimers, store, exitFullscreen, toggleFullscreen, activeCardIndex, settings.globalFontScale]);

    const handleExit = useCallback(() => {
        onExit();
    }, [onExit]);

    const handleAddTimer = useCallback(
        async (courseCode: string, courseTitle: string | undefined, program: string, studentCount: number, durationSeconds: number) => {
            // Auto-save new course if it doesn't exist
            const isNewCourse = !settings.savedCourses.some(c => c.code === courseCode);
            if (isNewCourse) {
                const levelMatch = courseCode.match(/\d{3}/);
                const yearLevel = levelMatch ? parseInt(levelMatch[0][0]) : 1;
                const newCourse = {
                    code: courseCode,
                    title: courseTitle || '',
                    program: program,
                    yearLevel,
                    recommendedStudentCount: studentCount
                };
                onUpdateSettings({ savedCourses: [...settings.savedCourses, newCourse] });
            }
            await store.createExamTimer(courseCode, courseTitle, program, studentCount, durationSeconds, groupId);
        },
        [store, groupId, settings.savedCourses, onUpdateSettings],
    );

    // ── Pointer-event Drag & Drop ─────────────────────────────────────
    // HTML5 Drag-and-Drop does NOT work reliably inside Tauri's WebView2
    // on Windows (the runtime intercepts native drag events for OS-level
    // file DnD). Instead we use pointer events: pointerdown to start
    // tracking, window-level pointermove to activate (after 8 px threshold)
    // and hit-test the target card via document.elementFromPoint, and
    // pointerup to perform the swap.

    /** Find the timer-card wrapper under a given screen coordinate. */
    const hitTestTimerCard = (x: number, y: number): string | null => {
        const el = document.elementFromPoint(x, y);
        const card = el?.closest('[data-timer-id]');
        return card?.getAttribute('data-timer-id') ?? null;
    };

    /** Begin tracking on primary-button press over a non-interactive area. */
    const handlePointerDown = (e: React.PointerEvent, id: string) => {
        if (e.button !== 0) return; // primary only
        const interactive = (e.target as HTMLElement).closest(
            'button, input, select, textarea, a, [role="button"]'
        );
        if (interactive) return;
        dragRef.current = {
            sourceId: id,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            active: false,
        };
    };

    // Window-level pointer listeners for move and up
    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            const state = dragRef.current;
            if (!state) return;
            // Only track the pointer that started the drag
            if (e.pointerId !== state.pointerId) return;

            const dx = e.clientX - state.startX;
            const dy = e.clientY - state.startY;

            // Activation threshold — prevents accidental drags from clicks
            if (!state.active) {
                if (Math.abs(dx) + Math.abs(dy) < 8) return;
                state.active = true;
                setDraggedId(state.sourceId);
                document.body.style.cursor = 'grabbing';
            }

            // Hit-test: which card is under the cursor right now?
            const targetId = hitTestTimerCard(e.clientX, e.clientY);
            if (targetId && targetId !== state.sourceId) {
                setHoveredId((prev) => (prev === targetId ? prev : targetId));
            } else {
                setHoveredId((prev) => (prev === null ? prev : null));
            }
        };

        const onUp = (e: PointerEvent) => {
            const state = dragRef.current;
            if (!state) return;
            if (e.pointerId !== state.pointerId) return;

            if (state.active) {
                const targetId = hitTestTimerCard(e.clientX, e.clientY);
                if (targetId && targetId !== state.sourceId) {
                    store.reorderTimers(state.sourceId, targetId);
                }
                document.body.style.cursor = '';
            }

            dragRef.current = null;
            setDraggedId(null);
            setHoveredId(null);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        // Cancel on pointer leaving the window
        window.addEventListener('pointercancel', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, [store]);

    if (isBlackout) {
        return <BlackoutScreen onReveal={disableBlackout} />;
    }

    // Empty state
    if (examTimers.length === 0) {
        return (
            <div className="relative h-screen w-screen bg-gray-50 dark:bg-gray-950 transition-colors">
                <EmptyState onAddTimer={() => setShowAddModal(true)} />
                {/* Toolbar even in empty state */}
                <div className={`absolute top-0 left-0 right-0 px-4 py-3 flex items-center justify-between
                         transition-all duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
                    <button
                        onClick={handleExit}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-500 hover:text-gray-900 
                       hover:bg-gray-200 dark:text-gray-400 dark:hover:text-white 
                       dark:hover:bg-white/10 transition-all text-sm"
                    >
                        <ArrowLeft size={16} />
                        Exit
                    </button>
                </div>
                {showAddModal && (
                    <AddExamTimerModal
                        onAdd={handleAddTimer}
                        onClose={() => setShowAddModal(false)}
                        timerCount={0}
                        savedCourses={settings.savedCourses || []}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="h-screen w-screen relative overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors">
            {/* Toolbar (Only for Grid View) */}
            {viewMode === 'grid' && (
                <div
                    data-tauri-drag-region
                    className={`absolute top-0 left-0 right-0 z-30 px-6 py-4 flex items-center justify-between
                        bg-white/90 dark:bg-black/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 transition-all duration-300
                        ${controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}
                >
                    {/* Left Side: Title & Subtitle */}
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-sm shadow-blue-500/20">
                            <LayoutGrid size={22} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">Exam Mode</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                {examTimers.length} Active {examTimers.length === 1 ? 'Exam' : 'Exams'}
                            </p>
                        </div>
                    </div>

                    {/* Right Side: Actions */}
                    <div className="flex items-center gap-2">
                        {/* Pause All */}
                        <button
                            onClick={() => store.pauseAll()}
                            disabled={!hasRunning}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-xl font-bold text-sm hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-40"
                            title="Pause All (P)"
                        >
                            <Pause size={16} fill="currentColor" />
                            <span className="hidden xl:inline">Pause All</span>
                        </button>

                        {/* Resume All */}
                        <button
                            onClick={() => store.resumeAll()}
                            disabled={!hasPaused}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-xl font-bold text-sm hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-40"
                            title="Resume All (Shift+P)"
                        >
                            <Play size={16} fill="currentColor" />
                            <span className="hidden xl:inline">Resume All</span>
                        </button>

                        <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-2 hidden md:block" />

                        {/* Add Timer */}
                        <button
                            onClick={() => setShowAddModal(true)}
                            disabled={examTimers.length >= 5}
                            className="p-2.5 rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 hidden md:block"
                            title={examTimers.length >= 5 ? 'Maximum 5 sessions reached' : 'Add Timer (N)'}
                        >
                            <Plus size={18} />
                        </button>

                        {/* Announce */}
                        {settings.announcementsEnabled && (
                            <button
                                onClick={() => setShowAnnounceModal(true)}
                                disabled={examTimers.length === 0}
                                className="p-2.5 rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 hidden md:block"
                                title="Manual Announcement"
                            >
                                <Mic size={18} />
                            </button>
                        )}

                        {/* Fullscreen */}
                        <button
                            onClick={toggleFullscreen}
                            className="p-2.5 rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors hidden sm:block"
                            title="Toggle Fullscreen (F11)"
                        >
                            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                        </button>

                        {/* View Toggle */}
                        <button
                            onClick={() => setViewMode((prev) => (prev === 'grid' ? 'center' : 'grid'))}
                            className="p-2.5 rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            title="Toggle View (V)"
                        >
                            {viewMode === 'grid' ? <Presentation size={18} /> : <LayoutGrid size={18} />}
                        </button>

                        {/* 2-Timer Layout Toggle — only visible when exactly 2 timers */}
                        {examTimers.length === 2 && (
                            <>
                                <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1" />
                                <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl">
                                    {([
                                        { mode: 'side-by-side', Icon: LayoutIconSideBySide, label: 'Side by Side (A)' },
                                        { mode: 'stacked', Icon: LayoutIconStacked, label: 'Stacked (B)' },
                                        { mode: 'primary-secondary', Icon: LayoutIconPrimarySecondary, label: 'Primary / Secondary (C)' },
                                    ] as const).map(({ mode, Icon, label }) => (
                                        <button
                                            key={mode}
                                            onClick={() => setTwoTimerMode(mode)}
                                            title={label}
                                            className={`p-2 rounded-lg transition-colors ${
                                                twoTimerMode === mode
                                                    ? 'bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-400 shadow-sm'
                                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                            }`}
                                        >
                                            <Icon />
                                        </button>
                                    ))}
                                </div>
                                {/* Swap Primary — only in primary-secondary mode */}
                                {twoTimerMode === 'primary-secondary' && (
                                    <button
                                        onClick={() => {
                                            const other = examTimers.find(t => t.id !== effectivePrimaryId);
                                            if (other) setPrimaryTimerId(other.id);
                                        }}
                                        title="Swap Primary card"
                                        className="p-2.5 rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-amber-100 hover:text-amber-600 dark:hover:bg-amber-900/30 dark:hover:text-amber-400 transition-colors"
                                    >
                                        <ArrowLeftRight size={16} />
                                    </button>
                                )}
                            </>
                        )}

                        <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1 hidden sm:block" />

                        {/* Settings */}
                        <button
                            onClick={onSettings}
                            className="p-2.5 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-white dark:hover:bg-gray-800 transition-all hidden sm:block"
                            title="Settings"
                        >
                            <Settings size={18} />
                        </button>

                        {/* Blackout */}
                        <button
                            onClick={enableBlackout}
                            className="p-2.5 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-white dark:hover:bg-gray-800 transition-all hidden lg:block"
                            title="Blackout (B)"
                        >
                            <Moon size={18} />
                        </button>

                        {/* Exit */}
                        <button
                            onClick={handleExit}
                            className="p-2.5 rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors ml-1"
                            title="Exit UI"
                        >
                            <Power size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Content Area */}
            {viewMode === 'grid' ? (
                <div
                    className={gridConfig.className}
                    style={gridConfig.style}
                    onClick={(e) => {
                        // Clicking directly on the grid background (not a card) clears card focus
                        if (e.target === e.currentTarget) setActiveCardIndex(null);
                    }}
                >
                    {orderedTimers.map((timer, index) => {
                        const isSource = draggedId === timer.id;
                        const isTarget = hoveredId === timer.id;
                        const isDragging = draggedId !== null;
                        return (
                            <div
                                key={timer.id}
                                data-timer-id={timer.id}
                                onPointerDown={(e) => handlePointerDown(e, timer.id)}
                                className={`
                                    ${getCardSpanClass(index, examTimers.length)}
                                    h-full min-h-0 select-none relative
                                    cursor-grab
                                    rounded-2xl
                                    ${isTarget ? 'drag-drop-target' : ''}
                                    ${isDragging ? 'touch-none' : ''}
                                    ${examTimers.length > 1 && activeCardIndex === index + 1 ? 'ring-2 ring-blue-500/70 ring-offset-2 ring-offset-transparent' : ''}
                                `}
                                style={{
                                    opacity: isSource ? 0.35 : 1,
                                    transition: 'opacity 0.15s ease, box-shadow 0.15s ease',
                                    cursor: isDragging ? 'grabbing' : undefined,
                                }}
                            >
                                {/* Keyboard shortcut badge — only shown with 2+ cards */}
                                {examTimers.length > 1 && (
                                    <div className={`absolute top-2 left-2 z-20 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold pointer-events-none transition-all duration-200
                                        ${activeCardIndex === index + 1
                                            ? 'bg-blue-500 text-white opacity-100 scale-110'
                                            : 'bg-gray-900/40 text-gray-300 opacity-60'}`}>
                                        {index + 1}
                                    </div>
                                )}
                                <TimerCard
                                    ref={(el) => { cardRefs.current[index] = el; }}
                                    timer={timer}
                                    settings={settings}
                                    timerCount={examTimers.length}
                                    onStart={store.startTimer}
                                    onPause={store.pauseTimer}
                                    onReset={store.resetTimer}
                                    onDelete={store.deleteTimer}
                                    onEdit={setEditTimerId}
                                    onDismiss={store.dismissTimer}
                                    onAddExtraTime={setExtraTimeTimerId}
                                    onFontSizeChange={(id, scale) => store.setFontSizeOverride(id, scale)}
                                    onFontSizeReset={(id) => store.setFontSizeOverride(id, null)}
                                    onUpdateSchedule={(id, s) => store.updateAnnouncementSchedule(id, s)}
                                    isBeingDragged={isSource}
                                    isDragTarget={isTarget}
                                    isDraggingActive={isDragging}
                                />
                            </div>
                        );
                    })}
                </div>
            ) : (
                <CenterStageView
                    timers={examTimers}
                    settings={settings}
                    controlsVisible={controlsVisible}
                    onStart={store.startTimer}
                    onPause={store.pauseTimer}
                    onReset={store.resetTimer}
                    onDelete={store.deleteTimer}
                    onEdit={setEditTimerId}
                    onDismiss={store.dismissTimer}
                    onReorder={store.reorderTimers}
                    onAddExtraTime={setExtraTimeTimerId}
                    onFontSizeChange={(id, scale) => store.setFontSizeOverride(id, scale)}
                    onFontSizeReset={(id) => store.setFontSizeOverride(id, null)}
                    onToggleView={() => setViewMode('grid')}
                    onExit={handleExit}
                    onSettings={onSettings}
                    onToggleFullscreen={toggleFullscreen}
                    isFullscreen={isFullscreen}
                    onAnnounce={() => setShowAnnounceModal(true)}
                />
            )}

            {/* Status Legend */}
            {viewMode === 'grid' && (
                <div className={`absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-gray-200 dark:border-gray-800 px-6 py-2.5 rounded-full shadow-xl flex items-center gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                            <span className="text-[11px] font-bold tracking-wider text-gray-600 dark:text-gray-300">NORMAL</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse" />
                            <span className="text-[11px] font-bold tracking-wider text-gray-600 dark:text-gray-300">WARNING</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                            <span className="text-[11px] font-bold tracking-wider text-gray-600 dark:text-gray-300">CRITICAL</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            {showAddModal && (
                <AddExamTimerModal
                    onAdd={handleAddTimer}
                    onClose={() => setShowAddModal(false)}
                    timerCount={examTimers.length}
                    savedCourses={settings.savedCourses || []}
                />
            )}

            {editTimerId && (
                <EditExamTimerModal
                    timer={examTimers.find(t => t.id === editTimerId)!}
                    onUpdate={store.updateExamTimer}
                    onClose={() => setEditTimerId(null)}
                />
            )}

            {extraTimeTimerId && (
                <ExtraTimeModal
                    timerLabel={
                        examTimers.find((t) => t.id === extraTimeTimerId)?.label ?? 'Timer'
                    }
                    onAddTime={(seconds) => {
                        store.addExtraTime(extraTimeTimerId, seconds);
                        setExtraTimeTimerId(null);
                    }}
                    onClose={() => setExtraTimeTimerId(null)}
                />
            )}

            {showAnnounceModal && (
                <AnnouncementModal
                    settings={settings}
                    timers={examTimers}
                    onClose={() => setShowAnnounceModal(false)}
                />
            )}
        </div>
    );
}

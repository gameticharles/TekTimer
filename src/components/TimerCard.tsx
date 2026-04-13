import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause, RotateCcw, X, Clock, Mic, Pencil, ArrowLeftRight } from 'lucide-react';
import { getEffectiveScale } from '../lib/fontSizeUtils';
import { SCALE_MIN, SCALE_MAX } from '../lib/fontSizeUtils';
import FontSizeControl from './FontSizeControl';
import ProgressBar from './ProgressBar';
import DismissOverlay from './DismissOverlay';
import AnnouncementScheduleEditor from './AnnouncementScheduleEditor';
import DynamicTimeDisplay from './DynamicTimeDisplay';
import { useProjectedEndTime } from '../hooks/useProjectedEndTime';
import type { ExamTimer, AppSettings, AnnouncementEntry } from '../lib/types';

interface TimerCardProps {
    timer: ExamTimer;
    settings: AppSettings;
    timerCount: number;
    onStart: (id: string) => void;
    onPause: (id: string) => void;
    onReset: (id: string) => void;
    onDelete: (id: string) => void;
    onEdit?: (id: string) => void;
    onDismiss: (id: string) => void;
    onAddExtraTime: (id: string) => void;
    onFontSizeChange: (id: string, scale: number) => void;
    onFontSizeReset: (id: string) => void;
    onUpdateSchedule?: (id: string, schedule: AnnouncementEntry[]) => void;
    /** Whether this card is currently being dragged (source). */
    isBeingDragged?: boolean;
    /** Whether this card is the active drop-swap target. */
    isDragTarget?: boolean;
    /** Whether ANY card drag is in progress (used to activate the event-capture shield). */
    isDraggingActive?: boolean;
}

function getCardVisualState(timer: ExamTimer, settings: AppSettings) {
    const { status, remainingSeconds, isDismissed } = timer;
    const { warningThresholdSeconds: warn, criticalThresholdSeconds: crit } = settings;

    let state = {
        bg: 'bg-white dark:bg-gray-900',
        textColor: 'text-gray-900 dark:text-white',
        border: 'border-gray-200 dark:border-gray-800',
        timeColor: 'text-gray-900 dark:text-white',
        badge: 'IDLE',
        badgeColor: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        anim: ''
    };

    if (isDismissed) {
        state.bg = 'bg-gray-50 dark:bg-gray-900/50';
        state.textColor = 'text-gray-400 dark:text-gray-600';
        state.timeColor = 'text-gray-400 dark:text-gray-600';
    } else if (status === 'Ended') {
        state.bg = 'bg-[#1a1212]';
        state.border = 'border-red-900/30';
        state.timeColor = 'text-red-500 dark:text-red-400 opacity-80';
        state.badge = 'ENDED';
        state.badgeColor = 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400';
        state.anim = '';
    } else if (status === 'Paused') {
        state.badge = 'PAUSED';
        state.timeColor = 'text-amber-600 dark:text-amber-500';
        state.badgeColor = 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400';
    } else if (status === 'Running') {
        state.badge = 'RUNNING';
        state.badgeColor = 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400';

        if (remainingSeconds <= crit) {
            state.timeColor = 'text-red-600 dark:text-red-400';
            state.border = 'border-red-300 dark:border-red-800/50';
            state.badge = 'CRITICAL';
            state.badgeColor = 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400';
            state.anim = 'animate-glow-critical';
        } else if (remainingSeconds <= warn) {
            state.timeColor = 'text-amber-600 dark:text-amber-400';
            state.border = 'border-amber-300 dark:border-amber-800/50';
            state.badge = 'WARNING';
            state.badgeColor = 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400';
            state.anim = 'animate-glow-warning';
        }
    }

    return state;
}

export default function TimerCard({
    timer,
    settings,
    timerCount,
    onStart,
    onPause,
    onReset,
    onDelete,
    onEdit,
    onDismiss,
    onAddExtraTime,
    onFontSizeChange,
    onFontSizeReset,
    onUpdateSchedule,
    isDragTarget = false,
    isDraggingActive = false,
}: TimerCardProps) {
    const [showScheduleEditor, setShowScheduleEditor] = useState(false);
    const [overlayVisible, setOverlayVisible] = useState(false);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Refs for fit-to-container measurement
    const containerRef = useRef<HTMLDivElement>(null);
    const clockRef = useRef<HTMLDivElement>(null);

    // ── Overlay visibility ──────────────────────────────────────────
    const showOverlay = useCallback(() => {
        setOverlayVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        // Keep visible while schedule editor is open — re-arm timer only when closed
        if (!showScheduleEditor) {
            hideTimerRef.current = setTimeout(() => setOverlayVisible(false), 1000);
        }
    }, [showScheduleEditor]);

    // Pin overlay open whenever the schedule editor is mounted
    useEffect(() => {
        if (showScheduleEditor) {
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
            setOverlayVisible(true);
        }
    }, [showScheduleEditor]);

    // ── Auto-dismiss ended timers ───────────────────────────────────
    useEffect(() => {
        if (
            timer.status !== 'Ended' ||
            timer.isDismissed ||
            !settings.autoDismissAfterSeconds
        ) return;
        const t = setTimeout(
            () => onDismiss(timer.id),
            settings.autoDismissAfterSeconds * 1000
        );
        return () => clearTimeout(t);
    }, [timer.status, timer.isDismissed, settings.autoDismissAfterSeconds, timer.id, onDismiss]);

    const { bg, textColor, border, timeColor, badge, badgeColor, anim } = getCardVisualState(timer, settings);

    const effectiveScale = getEffectiveScale(settings.globalFontScale, timer.fontSizeOverride);

    // ── Fit-to-container: measure actual rendered content size ─────────
    // The clock div (clockRef) has `w-full h-full` — its own dimensions always
    // equal the container. We need to measure its child (DynamicTimeDisplay),
    // which has natural content dimensions driven by the CSS container query.
    // We temporarily remove the scale transform so getBoundingClientRect() on the
    // child reflects the true layout dimensions (transforms don't affect layout
    // but DO affect getBoundingClientRect).
    const handleFit = useCallback(() => {
        const container = containerRef.current;
        const clock = clockRef.current;
        if (!container || !clock) {
            onFontSizeChange(timer.id, 100);
            return;
        }

        const contentEl = clock.firstElementChild as HTMLElement | null;
        if (!contentEl) {
            onFontSizeChange(timer.id, 100);
            return;
        }

        // Remove the transform so we measure the content's natural (container-query) size
        const savedTransform = clock.style.transform;
        clock.style.transform = 'none';

        // getBoundingClientRect() now reflects layout size without any scale transform
        const contentRect = contentEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Restore immediately
        clock.style.transform = savedTransform;

        const contentW = contentRect.width;
        const contentH = contentRect.height;
        const containerW = containerRect.width;
        const containerH = containerRect.height;

        if (contentW === 0 || contentH === 0 || containerW === 0 || containerH === 0) {
            onFontSizeChange(timer.id, 100);
            return;
        }

        // At scale=100% (transform none), contentW/H is the natural render size.
        // We want to scale the visual content to fill the container.
        // newScale = 100 * min(containerW/contentW, containerH/contentH)
        const widthRatio = containerW / contentW;
        const heightRatio = containerH / contentH;
        const fitRatio = Math.min(widthRatio, heightRatio);

        // Apply a small padding factor so the text doesn't butt against the edge
        const newScale = Math.round(fitRatio * 100 * 0.92);
        const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, newScale));
        onFontSizeChange(timer.id, clamped);
    }, [timer.id, onFontSizeChange]);

    const handleAddExtraTime = () => {
        onAddExtraTime(timer.id);
    };

    // Scale is applied as a CSS transform on top of the container-query base size.
    // This way A+/A- still work without fighting the container query sizing.
    const scaleTransform = effectiveScale !== 100
        ? `scale(${effectiveScale / 100})`
        : undefined;

    const beatKey = timer.status === 'Running' && timer.remainingSeconds <= 10
        ? timer.remainingSeconds
        : undefined;

    const formattedEndTime = useProjectedEndTime(timer.status, timer.remainingSeconds, timer.endTimeUnix);

    // Full title for the native tooltip
    const fullTitle = [timer.courseCode, timer.courseTitle].filter(Boolean).join(': ');

    return (
        <div
            className={`${bg} border ${border} rounded-2xl p-5 md:p-6 lg:p-8 flex flex-col relative overflow-hidden transition-all duration-300 h-full w-full shadow-lg dark:shadow-none
                ${isDragTarget ? 'animate-drag-target' : ''}`}
            onPointerMove={showOverlay}
            onPointerEnter={showOverlay}
        >
            {/* Dismiss Overlay */}
            <DismissOverlay timer={timer} settings={settings} onDismiss={onDismiss} timerCount={timerCount} />

            {/* Drop-swap target overlay: shown when this card is the hovered swap target */}
            {isDragTarget && (
                <div className="absolute inset-0 z-20 rounded-2xl bg-blue-500/10 flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center gap-2">
                        <div className="bg-blue-500/20 backdrop-blur-sm rounded-full p-3">
                            <ArrowLeftRight size={28} className="text-blue-400" />
                        </div>
                        <span className="text-blue-400 text-xs font-bold tracking-widest uppercase">Swap</span>
                    </div>
                </div>
            )}

            {/* Drag-capture shield — rendered ONLY while a pointer-drag is
                in progress. Sits at z-30 above all card content so that
                (a) buttons/controls cannot be accidentally clicked while
                dragging a card, and (b) document.elementFromPoint during
                the hit-test still resolves to this element, whose
                closest('[data-timer-id]') finds the outer wrapper. */}
            {isDraggingActive && (
                <div
                    className="absolute inset-0 z-30 rounded-2xl"
                    aria-hidden
                />
            )}

            {/* Header Area */}
            <div className={`flex justify-between items-start ${timerCount === 1 ? 'mb-8' : 'mb-6'}`}>
                {/* Title & Info */}
                <div className="flex-1 min-w-0 pr-4">
                    <h3
                        title={fullTitle}
                        className={`font-bold truncate leading-tight transition-colors ${textColor} ${timerCount === 1 ? 'text-4xl md:text-5xl lg:text-6xl mb-2' : timerCount === 2 ? 'text-2xl mb-1' : 'text-xl mb-1'}`}
                    >
                        {timer.courseCode || 'Untitled'}
                        {timer.courseTitle ? `: ${timer.courseTitle}` : ''}
                    </h3>
                    {(timer.program || timer.studentCount > 0) && (
                        <p className={`font-medium transition-colors ${timer.isDismissed ? 'text-gray-400 dark:text-gray-600' : 'text-gray-500 dark:text-gray-400'} ${timerCount === 1 ? 'text-2xl md:text-3xl lg:text-3xl' : 'text-base md:text-lg'}`}>
                            {[timer.program, timer.studentCount > 0 ? `${timer.studentCount} Students` : null].filter(Boolean).join(' • ')}
                        </p>
                    )}
                </div>

                {/* Badge & End Time */}
                <div className="flex flex-col items-end shrink-0">
                    <span className={`px-4 py-1.5 text-sm md:text-base font-bold tracking-widest rounded-full mb-1.5 transition-colors ${badgeColor}`}>
                        {badge}
                    </span>
                    {/* Only show projected end time while the timer is actively running */}
                    {timer.status === 'Running' && formattedEndTime && (
                        <span className="text-base md:text-lg text-gray-500 dark:text-gray-400 font-medium">
                            Ends at {formattedEndTime}
                        </span>
                    )}
                    {/* When idle/paused show the total duration — same style as 'Ends at' */}
                    {timer.status !== 'Running' && (
                        <span className="text-base md:text-lg text-gray-500 dark:text-gray-400 font-medium">
                            {Math.floor(timer.durationSeconds / 3600) > 0
                                ? `${Math.floor(timer.durationSeconds / 3600)}h ${Math.floor((timer.durationSeconds % 3600) / 60)}m exam`
                                : `${Math.floor(timer.durationSeconds / 60)}m exam`}
                        </span>
                    )}
                </div>
            </div>

            {/* exam-clock-container establishes CSS container context; the inner
                exam-clock div uses min(cqw, cqh) to auto-fit. Any A+/A- override
                is applied as a transform on the inner div. pointer-events-none
                ensures a visually overflowing clock never blocks the overlay. */}
            <div ref={containerRef} className="exam-clock-container flex-1 min-h-0 w-full relative">
                <div
                    ref={clockRef}
                    key={beatKey}
                    className={`exam-clock ${timeColor} ${anim} ${beatKey !== undefined ? 'animate-beat' : ''} select-none pointer-events-none flex items-center justify-center w-full transition-colors h-full`}
                    style={scaleTransform ? { transform: scaleTransform } : undefined}
                >
                    <DynamicTimeDisplay seconds={timer.remainingSeconds} />
                </div>
            </div>

            {/* Progress Bar — sits flush above the overlay */}
            {settings.showProgressBar && (
                <div className="w-full mt-2">
                    <ProgressBar
                        remainingSeconds={timer.remainingSeconds}
                        durationSeconds={timer.durationSeconds}
                        status={timer.status}
                        thickness={settings.progressBarHeight ?? 20}
                    />
                </div>
            )}

            {/* Controls Overlay — absolute, bottom of card, fades in on hover/interaction.
                onFocus keeps it visible when tabbing between buttons (feature #1).
                onKeyDown wires Space/Enter to start/pause (feature #2). */}
            <div
                tabIndex={-1}
                className={`absolute bottom-0 left-0 right-0 z-10 px-4 py-3 flex items-center justify-between
                    rounded-b-2xl backdrop-blur-md
                    bg-white/80 dark:bg-gray-900/85
                    border-t border-gray-200/60 dark:border-gray-700/60
                    transition-all duration-300 ease-in-out outline-none
                    ${overlayVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'}`}
                onPointerMove={showOverlay}
                onFocus={showOverlay}
            >
                {/* Left Side: Font Size + Fit-to-Container */}
                <div className="flex items-center gap-1">
                    <FontSizeControl
                        scale={effectiveScale}
                        isOverride={timer.fontSizeOverride !== null}
                        onChange={(s) => onFontSizeChange(timer.id, s)}
                        onReset={() => onFontSizeReset(timer.id)}
                        onFit={handleFit}
                        compact
                    />
                </div>

                {/* Right Side: Actions */}
                <div className="flex items-center gap-2">
                    {/* Add Time */}
                    <button
                        onClick={handleAddExtraTime}
                        disabled={timer.status === 'Ended' && timer.isDismissed}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
                        title="Add extra time"
                    >
                        <Clock size={14} />
                        <span className="hidden sm:inline">+Time</span>
                    </button>

                    {/* Start / Pause */}
                    {(timer.status === 'Idle' || timer.status === 'Paused') && (
                        <button
                            onClick={() => onStart(timer.id)}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-sm shadow-emerald-600/20 transition-colors"
                        >
                            <Play size={14} fill="currentColor" />
                            {timer.status === 'Idle' ? 'Start' : 'Resume'}
                        </button>
                    )}
                    {timer.status === 'Running' && (
                        <button
                            onClick={() => onPause(timer.id)}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-bold shadow-sm shadow-amber-500/20 transition-colors"
                        >
                            <Pause size={14} fill="currentColor" />
                            Pause
                        </button>
                    )}

                    {/* Reset */}
                    <button
                        onClick={() => onReset(timer.id)}
                        disabled={timer.status === 'Idle'}
                        className="p-1.5 rounded-xl text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:hover:text-white dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
                        aria-label="Reset"
                        title="Reset"
                    >
                        <RotateCcw size={16} />
                    </button>

                    {/* Divider */}
                    <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 mx-0.5" />

                    {onUpdateSchedule && settings.announcementsEnabled && (
                        <button
                            onClick={() => setShowScheduleEditor(true)}
                            className="p-1.5 rounded-xl text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:text-gray-400 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/30 transition-colors"
                            title="Announcements"
                        >
                            <Mic size={16} />
                        </button>
                    )}

                    {onEdit && (
                        <button
                            onClick={() => onEdit(timer.id)}
                            className="p-1.5 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                            title="Edit"
                        >
                            <Pencil size={16} />
                        </button>
                    )}

                    <button
                        onClick={() => onDelete(timer.id)}
                        className="p-1.5 rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                        title="Delete"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {showScheduleEditor && onUpdateSchedule && (
                <AnnouncementScheduleEditor
                    timer={timer}
                    settings={settings}
                    onSave={(schedule) => onUpdateSchedule(timer.id, schedule)}
                    onClose={() => setShowScheduleEditor(false)}
                />
            )}
        </div>
    );
}

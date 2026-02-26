import { useState, useEffect, useCallback, useRef } from 'react';
import type { ExamTimer, AppSettings } from '../lib/types';
import { Pause, Play, LayoutGrid, Mic, Settings, Maximize, Minimize, Power, Target, Clock, RotateCcw } from 'lucide-react';
import ProgressBar from './ProgressBar';
import DynamicTimeDisplay from './DynamicTimeDisplay';
import FontSizeControl from './FontSizeControl';
import { formatTime } from '../lib/formatTime';
import { useProjectedEndTime } from '../hooks/useProjectedEndTime';
import { getEffectiveScale, scaleClamp, getBaseClamp } from '../lib/fontSizeUtils';
import { getBaseClampKey } from '../lib/gridLayout';

interface CenterStageViewProps {
    timers: ExamTimer[];
    settings: AppSettings;
    controlsVisible: boolean;
    onStart: (id: string) => void;
    onPause: (id: string) => void;
    onReset: (id: string) => void;
    onDelete: (id: string) => void;
    onEdit?: (id: string) => void;
    onDismiss: (id: string) => void;
    onAddExtraTime: (id: string) => void;
    onFontSizeChange: (id: string, scale: number) => void;
    onFontSizeReset: (id: string) => void;
    onReorder: (sourceId: string, destId: string) => void;
    onToggleView: () => void;
    onExit: () => void;
    onSettings: () => void;
    onToggleFullscreen: () => void;
    isFullscreen: boolean;
    onAnnounce: () => void;
}

const CYCLE_INTERVAL_MS = 10000; // 10 seconds



export default function CenterStageView({
    timers,
    settings,
    controlsVisible,
    onStart,
    onPause,
    onReset,
    onAddExtraTime,
    onToggleView,
    onExit,
    onSettings,
    onToggleFullscreen,
    isFullscreen,
    onAnnounce,
    onFontSizeChange,
    onFontSizeReset
}: CenterStageViewProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isAutoCycling, setIsAutoCycling] = useState(true);
    const cycleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Auto-cycle logic
    const jumpToNext = useCallback(() => {
        if (timers.length <= 1) return;

        setActiveIndex((prev) => {
            let nextIdx = (prev + 1) % timers.length;

            if (settings.ignoreCompletedInCenterStage) {
                let attempts = 0;
                while (timers[nextIdx].status === 'Ended' && attempts < timers.length) {
                    nextIdx = (nextIdx + 1) % timers.length;
                    attempts++;
                }
                if (attempts >= timers.length) return 0;
            }

            return nextIdx;
        });
    }, [timers.length, settings.ignoreCompletedInCenterStage]);

    useEffect(() => {
        if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current);

        if (isAutoCycling && timers.length > 1) {
            cycleTimeoutRef.current = setTimeout(() => {
                jumpToNext();
            }, CYCLE_INTERVAL_MS);
        }

        return () => {
            if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current);
        };
    }, [activeIndex, isAutoCycling, timers.length, jumpToNext]);

    // Fast-forward if current is ended and setting is enabled
    useEffect(() => {
        if (!settings.ignoreCompletedInCenterStage || timers.length <= 1) return;

        const safeActiveIndex = activeIndex >= timers.length ? 0 : activeIndex;
        if (timers[safeActiveIndex]?.status === 'Ended') {
            const hasActive = timers.some(t => t.status !== 'Ended');
            if (hasActive) {
                jumpToNext();
            }
        }
    }, [activeIndex, timers, settings.ignoreCompletedInCenterStage, jumpToNext]);

    const handleSelect = (index: number) => {
        setActiveIndex(index);
        setIsAutoCycling(false); // Disable auto cycle on manual selection
    };

    if (timers.length === 0) return null;

    const safeActiveIndex = activeIndex >= timers.length ? 0 : activeIndex;
    const activeTimer = timers[safeActiveIndex];

    const isEnded = activeTimer.status === 'Ended';
    const isWarning = activeTimer.status === 'Running' && activeTimer.remainingSeconds <= settings.warningThresholdSeconds;
    const isCritical = activeTimer.status === 'Running' && activeTimer.remainingSeconds <= settings.criticalThresholdSeconds;

    let timeColorClass = 'text-gray-900 dark:text-white';
    let badgeClass = 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400';
    let badgeText = activeTimer.status.toUpperCase();

    if (isEnded) {
        timeColorClass = 'text-red-500 dark:text-red-400 blur-md opacity-60';
        badgeClass = 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400';
        badgeText = 'ENDED';
    } else if (isCritical) {
        timeColorClass = 'text-red-600 dark:text-red-400 animate-glow-critical';
        badgeClass = 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400';
        badgeText = 'CRITICAL';
    } else if (isWarning) {
        timeColorClass = 'text-amber-600 dark:text-amber-400 animate-glow-warning';
        badgeClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400';
        badgeText = 'WARNING';
    } else if (activeTimer.status === 'Paused') {
        timeColorClass = 'text-amber-600 dark:text-amber-500';
        badgeClass = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }

    const formattedEndTime = useProjectedEndTime(activeTimer.status, activeTimer.remainingSeconds, activeTimer.endTimeUnix);

    // Font Sizing matches what would be seen in Grid View (Base clamp uses '1' timer card for the massive display)
    const effectiveScale = getEffectiveScale(settings.globalFontScale, activeTimer.fontSizeOverride);
    const clampKey = getBaseClampKey(1);
    const baseClamp = getBaseClamp(clampKey);
    const computedSize = scaleClamp(baseClamp, effectiveScale);

    return (
        <div
            className="flex flex-col h-full w-full bg-gray-50 dark:bg-black p-6 relative transition-colors"
            style={{ '--exam-clock-size': computedSize } as React.CSSProperties}
        >
            {/* Top Toolbar */}
            <div
                className={`flex items-center justify-between mb-8 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                data-tauri-drag-region
            >
                {/* Header Title */}
                <div className="flex items-center gap-4">
                    <div className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-sm shadow-emerald-500/20">
                        <Target size={22} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">Focus Mode</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                            {timers.length} Active {timers.length === 1 ? 'Exam' : 'Exams'}
                        </p>
                    </div>
                </div>

                {/* Top Right Actions */}
                <div className="flex items-center gap-2">
                    {/* Auto-cycle toggle */}
                    <button
                        onClick={() => setIsAutoCycling(!isAutoCycling)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors ${isAutoCycling
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        title={isAutoCycling ? 'Pause Auto-cycle' : 'Resume Auto-cycle'}
                    >
                        {isAutoCycling ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                        <span className="hidden xl:inline">{isAutoCycling ? 'Auto-cycling' : 'Auto-cycle Paused'}</span>
                    </button>

                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-2 hidden md:block" />

                    {/* Quick Tools */}
                    {settings.announcementsEnabled && (
                        <button
                            onClick={onAnnounce}
                            className="p-2.5 rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors hidden md:block"
                            title="Manual Announcement"
                        >
                            <Mic size={18} />
                        </button>
                    )}
                    <button
                        onClick={onToggleFullscreen}
                        className="p-2.5 rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors hidden sm:block"
                        title="Toggle Fullscreen (F11)"
                    >
                        {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                    </button>
                    <button
                        onClick={onToggleView}
                        className="p-2.5 rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        title="Toggle View (V)"
                    >
                        <LayoutGrid size={18} />
                    </button>

                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1 hidden sm:block" />

                    <button
                        onClick={onSettings}
                        className="p-2.5 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-white dark:hover:bg-gray-800 transition-all hidden sm:block"
                        title="Settings"
                    >
                        <Settings size={18} />
                    </button>
                    <button
                        onClick={onExit}
                        className="p-2.5 rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors ml-1"
                        title="Exit UI"
                    >
                        <Power size={18} />
                    </button>
                </div>
            </div>

            {/* Horizontal Tabs */}
            <div className="flex items-center gap-3 overflow-x-auto pb-4 mb-4 hide-scrollbar pt-2 pl-2">
                {timers.map((t, idx) => {
                    const isSelected = idx === safeActiveIndex;
                    const isTabEnded = t.status === 'Ended';
                    const isTabWarning = t.status === 'Running' && t.remainingSeconds <= settings.warningThresholdSeconds;
                    const isTabCritical = t.status === 'Running' && t.remainingSeconds <= settings.criticalThresholdSeconds;

                    let barColor = 'border-blue-500';
                    let dotColor = 'bg-blue-500';
                    if (isTabEnded || isTabCritical) { barColor = 'border-red-500'; dotColor = 'bg-red-500'; }
                    else if (isTabWarning) { barColor = 'border-amber-500'; dotColor = 'bg-amber-500'; }
                    else if (t.status === 'Paused') { barColor = 'border-gray-400'; dotColor = 'bg-gray-400'; }

                    return (
                        <button
                            key={t.id}
                            onClick={() => handleSelect(idx)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-l-4 transition-all shrink-0 shadow-sm
                                ${barColor} 
                                ${isSelected
                                    ? 'bg-white dark:bg-gray-900 border-y border-r border-gray-200 dark:border-y-gray-700 dark:border-r-gray-700 shadow-md ring-1 ring-blue-500/20'
                                    : 'bg-transparent border-y border-r border-transparent hover:bg-white/50 dark:hover:bg-gray-800/50'
                                }`}
                        >
                            <div className="flex flex-col items-start font-medium text-left">
                                <span className={`flex items-center gap-2 text-sm truncate max-w-[140px] ${isSelected ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {t.courseCode || 'Untitled'}
                                    <div className={`w-1.5 h-1.5 rounded-full ${dotColor} ${isTabCritical && t.status === 'Running' ? 'animate-pulse' : ''}`} />
                                </span>
                                <span className={`text-xs font-mono tracking-tight ${isSelected ? 'text-gray-600 dark:text-gray-300' : 'text-gray-500 dark:text-gray-500'}`}>
                                    {formatTime(t.remainingSeconds, true)}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Central Bespoke Display */}
            <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800/60 rounded-3xl p-8 relative overflow-hidden shadow-2xl dark:shadow-none transition-colors">

                {/* Active Timer Info */}
                <div className="flex flex-col items-center mb-10 text-center relative z-10 w-full">
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <span className={`px-4 py-1.5 text-xs font-bold tracking-widest rounded-full transition-colors ${badgeClass}`}>
                            {badgeText}
                        </span>
                        {formattedEndTime && (
                            <span className="px-4 py-1.5 bg-gray-100 text-gray-700 dark:bg-gray-900/50 dark:text-gray-300 text-xs font-bold tracking-widest rounded-full border border-gray-200 dark:border-gray-800/50">
                                ENDS AT {formattedEndTime}
                            </span>
                        )}
                    </div>

                    <h2 className="text-4xl md:text-5xl lg:text-7xl font-bold text-gray-900 dark:text-white tracking-tight mb-4 transition-colors">
                        {activeTimer.courseCode || 'Untitled Timer'}
                        {activeTimer.courseTitle ? `: ${activeTimer.courseTitle}` : ''}
                    </h2>

                    {(activeTimer.program || activeTimer.studentCount > 0) && (
                        <p className="text-xl md:text-2xl text-gray-500 dark:text-gray-400 font-medium">
                            {[activeTimer.program, activeTimer.studentCount > 0 ? `${activeTimer.studentCount} Students` : null].filter(Boolean).join(' • ')}
                        </p>
                    )}
                </div>

                {/* Massive Clock */}
                <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[300px] relative z-10">
                    <div className={`exam-clock massive-clock ${timeColorClass} transition-colors tracking-tighter ${isEnded ? 'blur-md opacity-70' : ''}`} style={{ fontSize: 'var(--exam-clock-size, min(28vw, 25vh))' }}>
                        <DynamicTimeDisplay seconds={activeTimer.remainingSeconds} />
                    </div>
                    
                    {/* Time's Up Overlay Pill */}
                    {isEnded && (
                        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                            <div className="bg-red-500 text-white font-bold text-5xl md:text-7xl lg:text-8xl px-16 py-6 md:px-24 md:py-8 rounded-[3rem] shadow-[0_0_100px_rgba(239,68,68,0.6)] border-2 border-red-400/30 animate-in fade-in zoom-in duration-500">
                                Time's Up!
                            </div>
                        </div>
                    )}
                </div>

                {/* Progress Bar - Wide */}
                {settings.showProgressBar && (
                    <div className="w-full max-w-5xl mt-2 mb-4 relative z-10">
                        <ProgressBar
                            remainingSeconds={activeTimer.remainingSeconds}
                            durationSeconds={activeTimer.durationSeconds}
                            status={activeTimer.status}
                            thickness={settings.progressBarHeight ?? 20}
                        />
                    </div>
                )}

                {/* Time Remaining Label */}
                <p className={`uppercase tracking-widest text-sm font-bold relative z-10 ${activeTimer.status === 'Running' ? 'text-gray-400 dark:text-gray-500' : timeColorClass}`}>
                    Time Remaining
                </p>

                {/* Action Buttons */}
                <div className={`absolute bottom-8 right-8 flex items-center gap-3 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <button
                        onClick={() => onAddExtraTime(activeTimer.id)}
                        disabled={activeTimer.status === 'Ended' && activeTimer.isDismissed}
                        className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 font-bold transition-colors disabled:opacity-40"
                    >
                        <Clock size={18} />
                        + Time
                    </button>

                    {(activeTimer.status === 'Idle' || activeTimer.status === 'Paused') && (
                        <button
                            onClick={() => onStart(activeTimer.id)}
                            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/20 transition-colors"
                        >
                            <Play size={18} fill="currentColor" />
                            {activeTimer.status === 'Idle' ? 'Start' : 'Resume'}
                        </button>
                    )}

                    {activeTimer.status === 'Running' && (
                        <button
                            onClick={() => onPause(activeTimer.id)}
                            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-white font-bold shadow-lg shadow-amber-500/20 transition-colors"
                        >
                            <Pause size={18} fill="currentColor" />
                            Pause
                        </button>
                    )}

                    <button
                        onClick={() => onReset(activeTimer.id)}
                        disabled={activeTimer.status === 'Idle'}
                        className="p-3 rounded-2xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
                        title="Reset"
                    >
                        <RotateCcw size={18} />
                    </button>
                </div>

                {/* Font Size Control - Bottom Left */}
                <div className={`absolute bottom-8 left-8 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <FontSizeControl
                        scale={effectiveScale}
                        isOverride={activeTimer.fontSizeOverride !== null}
                        onChange={(s) => onFontSizeChange(activeTimer.id, s)}
                        onReset={() => onFontSizeReset(activeTimer.id)}
                        compact
                    />
                </div>

                {/* Ambient glow effect behind timer (Optional, for aesthetics) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 dark:bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .massive-clock {
                    line-height: 0.85;
                    font-variant-numeric: tabular-nums;
                }
            `}} />
        </div>
    );
}

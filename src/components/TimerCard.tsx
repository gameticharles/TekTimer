import { useState, useMemo } from 'react';
import { Play, Pause, RotateCcw, X, Clock, Mic } from 'lucide-react';
import { formatTime } from '../lib/formatTime';
import { getEffectiveScale, scaleClamp, getBaseClamp } from '../lib/fontSizeUtils';
import { getBaseClampKey } from '../lib/gridLayout';
import FontSizeControl from './FontSizeControl';
import ProgressBar from './ProgressBar';
import DismissOverlay from './DismissOverlay';
import AnnouncementScheduleEditor from './AnnouncementScheduleEditor';
import type { ExamTimer, AppSettings, AnnouncementEntry } from '../lib/types';

interface TimerCardProps {
    timer: ExamTimer;
    settings: AppSettings;
    timerCount: number;
    onStart: (id: string) => void;
    onPause: (id: string) => void;
    onReset: (id: string) => void;
    onDelete: (id: string) => void;
    onDismiss: (id: string) => void;
    onAddExtraTime: (id: string) => void;
    onFontSizeChange: (id: string, scale: number) => void;
    onFontSizeReset: (id: string) => void;
    onUpdateSchedule?: (id: string, schedule: AnnouncementEntry[]) => void;
}

function getCardVisualState(timer: ExamTimer, settings: AppSettings) {
    const { status, remainingSeconds, isDismissed } = timer;
    const { warningThresholdSeconds: warn, criticalThresholdSeconds: crit } = settings;

    if (isDismissed) return { bg: 'bg-gray-900/60', textColor: 'text-gray-600', anim: '', border: 'border-gray-800' };
    if (status === 'Ended') return { bg: 'bg-red-950/80', textColor: 'text-white animate-blink', anim: '', border: 'border-red-800' };
    if (status === 'Running' && remainingSeconds <= 10)
        return { bg: 'bg-gray-900/80', textColor: 'text-red-400', anim: 'animate-glow-critical', border: 'border-red-800/50' };
    if (remainingSeconds <= crit && status === 'Running')
        return { bg: 'bg-gray-900/80', textColor: 'text-red-400', anim: 'animate-glow-critical', border: 'border-red-800/50' };
    if (remainingSeconds <= warn && status === 'Running')
        return { bg: 'bg-gray-900/80', textColor: 'text-amber-400', anim: 'animate-glow-warning', border: 'border-amber-800/50' };
    return { bg: 'bg-gray-900/80', textColor: 'text-white', anim: '', border: 'border-gray-700/50' };
}

export default function TimerCard({
    timer,
    settings,
    timerCount,
    onStart,
    onPause,
    onReset,
    onDelete,
    onDismiss,
    onAddExtraTime,
    onFontSizeChange,
    onFontSizeReset,
    onUpdateSchedule,
}: TimerCardProps) {
    const [recentExtraTime, setRecentExtraTime] = useState<number | null>(null);
    const [showScheduleEditor, setShowScheduleEditor] = useState(false);
    const { bg, textColor, anim, border } = getCardVisualState(timer, settings);

    const effectiveScale = getEffectiveScale(settings.globalFontScale, timer.fontSizeOverride);
    const clampKey = getBaseClampKey(timerCount);
    const baseClamp = getBaseClamp(clampKey);
    const computedSize = scaleClamp(baseClamp, effectiveScale);

    const timeDisplay = useMemo(() => formatTime(timer.remainingSeconds, true), [timer.remainingSeconds]);

    const beatKey = timer.status === 'Running' && timer.remainingSeconds <= 10
        ? timer.remainingSeconds
        : undefined;

    return (
        <div
            className={`${bg} border ${border} rounded-xl p-4 flex flex-col relative overflow-hidden transition-all duration-300 h-full w-full`}
            style={{ '--exam-clock-size': computedSize } as React.CSSProperties}
        >
            {/* Dismiss Overlay */}
            <DismissOverlay timer={timer} settings={settings} onDismiss={onDismiss} />

            {/* Extra time badge */}
            {recentExtraTime && (
                <div className="absolute top-4 right-12 bg-emerald-600 text-white font-bold px-3 py-1 
                        rounded-lg text-sm animate-fade-out z-20"
                    onAnimationEnd={() => setRecentExtraTime(null)}>
                    +{recentExtraTime / 60} min
                </div>
            )}

            {/* Header */}
            <div className={`flex items-center justify-between ${timerCount === 1 ? 'mb-4' : 'mb-2'}`}>
                <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-white truncate leading-normal py-1 ${timerCount === 1 ? 'text-3xl md:text-5xl lg:text-6xl' : timerCount === 2 ? 'text-2xl' : 'text-xl'}`}>
                        {timer.courseCode}
                        <span className={`text-gray-400 font-normal ml-3 ${timerCount === 1 ? 'text-2xl md:text-4xl lg:text-5xl' : timerCount === 2 ? 'text-xl' : 'text-lg'}`}>· {timer.program}</span>
                    </h3>
                </div>
                <button
                    onClick={() => onDelete(timer.id)}
                    className={`p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-2 ${!onUpdateSchedule ? 'opacity-0 pointer-events-none' : ''} ${timerCount === 1 ? 'transform scale-150 mr-2' : ''}`}
                    aria-label="Delete timer"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Progress Bar */}
            {settings.showProgressBar && (
                <ProgressBar
                    remainingSeconds={timer.remainingSeconds}
                    durationSeconds={timer.durationSeconds}
                    status={timer.status}
                />
            )}

            {/* Clock */}
            <div className="flex-1 flex items-center justify-center">
                <div
                    key={beatKey}
                    className={`exam-clock ${textColor} ${anim} ${beatKey !== undefined ? 'animate-beat' : ''} select-none`}
                >
                    {timeDisplay}
                </div>
            </div>

            {/* Paused indicator */}
            {timer.status === 'Paused' && (
                <p className="text-center text-amber-400/60 text-xs font-medium animate-pulse mb-1">
                    ⏸ PAUSED
                </p>
            )}

            {/* Controls */}
            <div className="flex items-center justify-between mt-auto pt-2">
                <FontSizeControl
                    scale={effectiveScale}
                    isOverride={timer.fontSizeOverride !== null}
                    onChange={(s) => onFontSizeChange(timer.id, s)}
                    onReset={() => onFontSizeReset(timer.id)}
                    compact
                />

                <div className="flex items-center gap-1.5">
                    {/* Edit Announcements */}
                    {onUpdateSchedule && settings.announcementsEnabled && (
                        <button
                            onClick={() => setShowScheduleEditor(true)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-400 hover:bg-gray-700 transition-colors"
                            title="Edit Announcement Schedule"
                        >
                            <Mic size={14} />
                        </button>
                    )}

                    {/* Extra Time */}
                    <button
                        onClick={() => onAddExtraTime(timer.id)}
                        disabled={timer.status === 'Ended' && timer.isDismissed}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-300 
                       hover:bg-gray-700 transition-colors disabled:opacity-40"
                        title="Add extra time"
                    >
                        <Clock size={12} />
                        +Time
                    </button>

                    {/* Start / Pause */}
                    {(timer.status === 'Idle' || timer.status === 'Paused') && (
                        <button
                            onClick={() => onStart(timer.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white 
                         text-xs font-semibold hover:bg-emerald-500 transition-colors"
                        >
                            <Play size={12} fill="currentColor" />
                            {timer.status === 'Idle' ? 'Start' : 'Resume'}
                        </button>
                    )}
                    {timer.status === 'Running' && (
                        <button
                            onClick={() => onPause(timer.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 text-white 
                         text-xs font-semibold hover:bg-amber-500 transition-colors"
                        >
                            <Pause size={12} />
                            Pause
                        </button>
                    )}

                    {/* Reset */}
                    <button
                        onClick={() => onReset(timer.id)}
                        disabled={timer.status === 'Idle'}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 
                       disabled:opacity-30 transition-colors"
                        aria-label="Reset"
                    >
                        <RotateCcw size={14} />
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

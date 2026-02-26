import { useState } from 'react';
import { Play, Pause, RotateCcw, X, Clock, Mic, Pencil } from 'lucide-react';
import { getEffectiveScale, scaleClamp, getBaseClamp } from '../lib/fontSizeUtils';
import { getBaseClampKey } from '../lib/gridLayout';
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
}: TimerCardProps) {
    const [showScheduleEditor, setShowScheduleEditor] = useState(false);

    const handleAddExtraTime = () => {
        onAddExtraTime(timer.id);
    };

    const { bg, textColor, border, timeColor, badge, badgeColor, anim } = getCardVisualState(timer, settings);

    const effectiveScale = getEffectiveScale(settings.globalFontScale, timer.fontSizeOverride);
    const clampKey = getBaseClampKey(timerCount);
    const baseClamp = getBaseClamp(clampKey);
    const computedSize = scaleClamp(baseClamp, effectiveScale);

    const beatKey = timer.status === 'Running' && timer.remainingSeconds <= 10
        ? timer.remainingSeconds
        : undefined;

    const formattedEndTime = useProjectedEndTime(timer.status, timer.remainingSeconds, timer.endTimeUnix);

    return (
        <div
            className={`${bg} border ${border} rounded-2xl p-5 md:p-6 lg:p-8 flex flex-col relative overflow-hidden transition-all duration-300 h-full w-full shadow-lg dark:shadow-none`}
            style={{ '--exam-clock-size': computedSize } as React.CSSProperties}
        >
            {/* Dismiss Overlay */}
            <DismissOverlay timer={timer} settings={settings} onDismiss={onDismiss} />

            {/* Header Area */}
            <div className={`flex justify-between items-start ${timerCount === 1 ? 'mb-8' : 'mb-6'}`}>
                {/* Title & Info */}
                <div className="flex-1 min-w-0 pr-4">
                    <h3 className={`font-bold truncate leading-tight transition-colors ${textColor} ${timerCount === 1 ? 'text-4xl md:text-5xl lg:text-6xl mb-2' : timerCount === 2 ? 'text-2xl mb-1' : 'text-xl mb-1'}`}>
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
                    {formattedEndTime && (
                        <span className="text-base md:text-lg text-gray-500 dark:text-gray-400 font-medium">
                            Ends at {formattedEndTime}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full mb-4 relative">
                <div
                    key={beatKey}
                    className={`exam-clock ${timeColor} ${anim} ${beatKey !== undefined ? 'animate-beat' : ''} select-none flex items-center justify-center w-full transition-colors h-full`}
                >
                    <DynamicTimeDisplay seconds={timer.remainingSeconds} />
                </div>

                {/* Time's Up Screen is handled by DismissOverlay */}
            </div>

            {/* Progress Bar */}
            {settings.showProgressBar && (
                <div className="mb-4 w-full">
                    <ProgressBar
                        remainingSeconds={timer.remainingSeconds}
                        durationSeconds={timer.durationSeconds}
                        status={timer.status}
                        thickness={settings.progressBarHeight ?? 20}
                    />
                </div>
            )}

            {/* Time Remaining Label below progress bar */}
            <div className="w-full flex justify-center mb-6">
                <p className={`uppercase tracking-widest text-sm font-bold ${timer.status === 'Running' ? 'text-gray-400 dark:text-gray-500' : timeColor}`}>
                    Time Remaining
                </p>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mt-auto">
                {/* Left Side: Font Size */}
                <FontSizeControl
                    scale={effectiveScale}
                    isOverride={timer.fontSizeOverride !== null}
                    onChange={(s) => onFontSizeChange(timer.id, s)}
                    onReset={() => onFontSizeReset(timer.id)}
                    compact
                />

                {/* Right Side: Actions */}
                <div className="flex items-center gap-2">
                    {/* Add Time */}
                    <button
                        onClick={handleAddExtraTime}
                        disabled={timer.status === 'Ended' && timer.isDismissed}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
                        title="Add extra time"
                    >
                        <Clock size={14} />
                        <span className="hidden sm:inline">+Time</span>
                    </button>

                    {/* Start / Pause */}
                    {(timer.status === 'Idle' || timer.status === 'Paused') && (
                        <button
                            onClick={() => onStart(timer.id)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-sm shadow-emerald-600/20 transition-colors"
                        >
                            <Play size={14} fill="currentColor" />
                            {timer.status === 'Idle' ? 'Start' : 'Resume'}
                        </button>
                    )}
                    {timer.status === 'Running' && (
                        <button
                            onClick={() => onPause(timer.id)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-bold shadow-sm shadow-amber-500/20 transition-colors"
                        >
                            <Pause size={14} fill="currentColor" />
                            Pause
                        </button>
                    )}

                    {/* Reset */}
                    <button
                        onClick={() => onReset(timer.id)}
                        disabled={timer.status === 'Idle'}
                        className="p-2 rounded-xl text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:hover:text-white dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
                        aria-label="Reset"
                        title="Reset"
                    >
                        <RotateCcw size={16} />
                    </button>

                    {/* Menu / Edit / Delete */}
                    <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

                    {onUpdateSchedule && settings.announcementsEnabled && (
                        <button
                            onClick={() => setShowScheduleEditor(true)}
                            className="p-2 rounded-xl text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:text-gray-400 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/30 transition-colors"
                            title="Announcements"
                        >
                            <Mic size={16} />
                        </button>
                    )}

                    {onEdit && (
                        <button
                            onClick={() => onEdit(timer.id)}
                            className="p-2 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                            title="Edit"
                        >
                            <Pencil size={16} />
                        </button>
                    )}

                    <button
                        onClick={() => onDelete(timer.id)}
                        className="p-2 rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/30 transition-colors"
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

import type { QuizTimer as QuizTimerType, AppSettings } from '../lib/types';
import DynamicTimeDisplay from './DynamicTimeDisplay';
import ProgressBar from './ProgressBar';
import { getEffectiveScale, scaleClamp, getBaseClamp } from '../lib/fontSizeUtils';

interface QuizTimerProps {
    timer: QuizTimerType;
    settings: AppSettings;
}

function getVisualState(timer: QuizTimerType, settings: AppSettings) {
    const { status, remainingSeconds, isDismissed } = timer;
    const { warningThresholdSeconds: warn, criticalThresholdSeconds: crit } = settings;

    if (isDismissed) return { bg: 'bg-gray-50 dark:bg-gray-950', textColor: 'text-gray-300 dark:text-gray-600', anim: '', labelColor: 'text-gray-400 dark:text-gray-700' };
    if (status === 'Ended') return { bg: 'bg-red-50 dark:bg-red-950', textColor: 'text-red-600 dark:text-white animate-blink', anim: '', labelColor: 'text-red-500 dark:text-red-200' };
    if (status === 'Running' && remainingSeconds <= 10)
        return { bg: 'bg-white dark:bg-gray-950', textColor: 'text-red-500 dark:text-red-400', anim: 'animate-glow-critical', labelColor: 'text-red-400 dark:text-red-300' };
    if (remainingSeconds <= crit && status === 'Running')
        return { bg: 'bg-white dark:bg-gray-950', textColor: 'text-red-500 dark:text-red-400', anim: 'animate-glow-critical', labelColor: 'text-red-400 dark:text-red-300' };
    if (remainingSeconds <= warn && status === 'Running')
        return { bg: 'bg-white dark:bg-gray-950', textColor: 'text-amber-500 dark:text-amber-400', anim: 'animate-glow-warning', labelColor: 'text-amber-600 dark:text-amber-300' };
    return { bg: 'bg-white dark:bg-gray-950', textColor: 'text-gray-900 dark:text-white', anim: '', labelColor: 'text-gray-500 dark:text-gray-400' };
}

export default function QuizTimerDisplay({ timer, settings }: QuizTimerProps) {
    const { bg, textColor, anim, labelColor } = getVisualState(timer, settings);

    const effectiveScale = getEffectiveScale(settings.globalFontScale, timer.fontSizeOverride);
    const baseClamp = getBaseClamp('quiz');
    const computedSize = scaleClamp(baseClamp, effectiveScale);

    // Use remainingSeconds as key to trigger beat animation on each second change
    const beatKey = timer.status === 'Running' && timer.remainingSeconds <= 10
        ? timer.remainingSeconds
        : undefined;

    return (
        <div className={`${bg} h-full w-full flex flex-col items-center justify-center relative transition-colors duration-500`}
            style={{ '--quiz-clock-size': computedSize } as React.CSSProperties}>
            {/* Label */}
            {timer.label && (
                <p className={`${labelColor} text-xl font-medium mb-4 transition-colors duration-500`}>
                    {timer.label}
                </p>
            )}

            {/* Clock and Progress Bar */}
            <div className="w-full flex flex-col items-center justify-center min-h-0">
                <div
                    key={beatKey}
                    className={`quiz-clock ${textColor} ${anim} ${beatKey !== undefined ? 'animate-beat' : ''} select-none flex items-center justify-center w-full`}
                >
                    <DynamicTimeDisplay seconds={timer.remainingSeconds} />
                </div>
                
                {settings.showProgressBar && (
                    <div className="w-full max-w-4xl mt-8 px-6">
                        <ProgressBar
                            remainingSeconds={timer.remainingSeconds}
                            durationSeconds={timer.durationSeconds}
                            status={timer.status}
                            thickness={settings.progressBarHeight ?? 20}
                        />
                    </div>
                )}
            </div>

            {/* Status indicator */}
            {timer.status === 'Paused' && (
                <p className="text-amber-600/70 dark:text-amber-400/70 text-lg mt-4 animate-pulse font-medium">
                    ⏸ PAUSED
                </p>
            )}

            {/* End message overlay */}
            {timer.status === 'Ended' && !timer.isDismissed && (
                <div className="mt-8">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white text-center animate-pulse">
                        {settings.endMessage}
                    </p>
                </div>
            )}
        </div>
    );
}

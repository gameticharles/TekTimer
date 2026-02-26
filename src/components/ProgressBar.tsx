import type { TimerStatus } from '../lib/types';

interface ProgressBarProps {
    remainingSeconds: number;
    durationSeconds: number;
    status: TimerStatus;
    thickness: number;
}

export default function ProgressBar({
    remainingSeconds,
    durationSeconds,
    status,
    thickness,
}: ProgressBarProps) {
    const pct = durationSeconds > 0
        ? (remainingSeconds / durationSeconds) * 100
        : 0;

    const baseColor =
        status === 'Ended' ? 'from-red-500 to-red-600 dark:from-red-600 dark:to-red-700' :
            pct <= 10 ? 'from-red-500 to-red-600 dark:from-red-600 dark:to-red-700' :
                pct <= 25 ? 'from-amber-400 to-amber-500 dark:from-amber-500 dark:to-amber-600' :
                    'from-blue-400 to-blue-500 dark:from-blue-500 dark:to-blue-600';

    return (
        <div
            className="w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden transition-colors shadow-inner"
            style={{ height: `${thickness}px` }}
        >
            <div
                className={`h-full transition-all duration-500 ease-out bg-gradient-to-r ${baseColor}`}
                style={{ width: `${pct}%` }}
                role="progressbar"
                aria-valuenow={remainingSeconds}
                aria-valuemin={0}
                aria-valuemax={durationSeconds}
            />
        </div>
    );
}

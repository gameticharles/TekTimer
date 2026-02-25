import type { TimerStatus } from '../lib/types';

interface ProgressBarProps {
    remainingSeconds: number;
    durationSeconds: number;
    status: TimerStatus;
    variant?: 'card' | 'fullwidth';
}

export default function ProgressBar({
    remainingSeconds,
    durationSeconds,
    status,
    variant = 'card',
}: ProgressBarProps) {
    const pct = durationSeconds > 0
        ? (remainingSeconds / durationSeconds) * 100
        : 0;

    const color =
        status === 'Ended' ? 'bg-red-500' :
            pct <= 10 ? 'bg-red-500' :
                pct <= 25 ? 'bg-amber-400' :
                    'bg-emerald-500';

    const height = variant === 'fullwidth' ? 'h-1.5' : 'h-2';

    return (
        <div className={`w-full ${height} bg-gray-700/50 rounded-full overflow-hidden`}>
            <div
                className={`h-full transition-all duration-500 ease-out ${color}`}
                style={{ width: `${pct}%` }}
                role="progressbar"
                aria-valuenow={remainingSeconds}
                aria-valuemin={0}
                aria-valuemax={durationSeconds}
            />
        </div>
    );
}

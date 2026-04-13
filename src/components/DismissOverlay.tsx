import { BellOff } from 'lucide-react';
import type { AnyTimer, AppSettings } from '../lib/types';

interface DismissOverlayProps {
    timer: AnyTimer;
    settings: AppSettings;
    onDismiss: (id: string) => void;
    /** Number of timer cards currently visible — used to scale font size. */
    timerCount?: number;
}

export default function DismissOverlay({ timer, settings, onDismiss, timerCount = 1 }: DismissOverlayProps) {
    if (timer.status !== 'Ended' || timer.isDismissed) return null;

    const timerName = 'courseCode' in timer ? timer.courseCode : timer.label;

    // Scale the end-message font down as more cards fill the grid
    const msgClass =
        timerCount === 1
            ? 'text-4xl md:text-5xl'
            : timerCount === 2
                ? 'text-2xl md:text-3xl'
                : 'text-xl md:text-2xl';

    return (
        <div className="absolute inset-0 bg-red-950/30 backdrop-blur-sm flex flex-col items-center justify-center z-[15] rounded-xl">
            <p className={`${msgClass} font-black text-white mb-3 text-center px-4 animate-dismiss-pulse`}>
                {settings.endMessage}
            </p>
            <p className="text-base text-red-200 mb-8">{timerName}</p>
            <button
                onClick={() => onDismiss(timer.id)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-800 text-white font-semibold
                   hover:bg-red-700 transition-colors shadow-lg"
            >
                <BellOff size={20} />
                Silence & Dismiss
            </button>
        </div>
    );
}

import { BellOff } from 'lucide-react';
import type { AnyTimer, AppSettings } from '../lib/types';

interface DismissOverlayProps {
    timer: AnyTimer;
    settings: AppSettings;
    onDismiss: (id: string) => void;
}

export default function DismissOverlay({ timer, settings, onDismiss }: DismissOverlayProps) {
    if (timer.status !== 'Ended' || timer.isDismissed) return null;

    const timerName = 'courseCode' in timer ? timer.courseCode : timer.label;

    return (
        <div className="absolute inset-0 bg-red-950/30 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl">
            <p className="text-4xl md:text-5xl font-black text-white mb-3 text-center px-4 animate-pulse">
                {settings.endMessage}
            </p>
            <p className="text-xl text-red-200 mb-8">{timerName}</p>
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

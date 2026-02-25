import { Clock, Play, Pause } from 'lucide-react';
import type { ExamTimer, AppSettings } from '../lib/types';
import { formatTime } from '../lib/formatTime';
import ProgressBar from './ProgressBar';

interface MiniTimerCardProps {
    timer: ExamTimer;
    settings: AppSettings;
    isActive: boolean;
    onClick: () => void;
}

export default function MiniTimerCard({ timer, settings, isActive, onClick }: MiniTimerCardProps) {
    const { status, remainingSeconds, isDismissed } = timer;
    const { warningThresholdSeconds: warn, criticalThresholdSeconds: crit } = settings;

    let bg = isActive ? 'bg-gray-800' : 'bg-gray-900/50';
    let border = isActive ? 'border-blue-500/50' : 'border-gray-800';
    let textColor = 'text-gray-300';
    let anim = '';

    if (isDismissed) {
        bg = 'bg-gray-900/30';
        textColor = 'text-gray-600';
    } else if (status === 'Ended') {
        bg = isActive ? 'bg-red-900/40' : 'bg-red-950/40';
        border = 'border-red-800/50';
        textColor = 'text-red-400 animate-blink';
    } else if (status === 'Running') {
        if (remainingSeconds <= 10) {
            textColor = 'text-red-400';
            anim = 'animate-glow-critical';
            border = 'border-red-500/50';
        } else if (remainingSeconds <= crit) {
            textColor = 'text-red-400';
            anim = 'animate-glow-critical';
            border = 'border-red-500/50';
        } else if (remainingSeconds <= warn) {
            textColor = 'text-amber-400';
            anim = 'animate-glow-warning';
            border = 'border-amber-500/50';
        }
    }

    return (
        <div
            onClick={onClick}
            className={`px-3 py-2 border ${border} ${bg} rounded-lg cursor-pointer transition-all hover:bg-gray-800 
                  ${anim} flex flex-col gap-1.5 shadow-sm group`}
        >
            <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white truncate max-w-[120px]" title={timer.courseCode || 'Timer'}>
                    {timer.courseCode || 'Timer'}
                </span>

                {/* Status Icon */}
                <div className="text-gray-500 flex-shrink-0">
                    {status === 'Running' && <Play size={12} className="text-emerald-500" fill="currentColor" />}
                    {status === 'Paused' && <Pause size={12} className="text-amber-500" fill="currentColor" />}
                    {status === 'Ended' && <Clock size={12} className="text-red-500" />}
                </div>
            </div>

            <div className={`text-xl font-bold font-mono tracking-tight ${textColor}`}>
                {formatTime(remainingSeconds, true)}
            </div>

            {settings.showProgressBar && (
                <div className="mt-0.5">
                    <ProgressBar
                        remainingSeconds={timer.remainingSeconds}
                        durationSeconds={timer.durationSeconds}
                        status={timer.status}
                        variant="fullwidth"
                    />
                </div>
            )}
        </div>
    );
}

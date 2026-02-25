import { useState, useEffect, useCallback, useRef } from 'react';
import type { ExamTimer, AppSettings } from '../lib/types';
import TimerCard from './TimerCard';
import MiniTimerCard from './MiniTimerCard';
import { Pause, Play } from 'lucide-react';

interface CenterStageViewProps {
    timers: ExamTimer[];
    settings: AppSettings;
    onStart: (id: string) => void;
    onPause: (id: string) => void;
    onReset: (id: string) => void;
    onDelete: (id: string) => void;
    onDismiss: (id: string) => void;
    onAddExtraTime: (id: string) => void;
    onFontSizeChange: (id: string, scale: number) => void;
    onFontSizeReset: (id: string) => void;
}

const CYCLE_INTERVAL_MS = 10000; // 10 seconds

export default function CenterStageView({
    timers,
    settings,
    ...actions
}: CenterStageViewProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isAutoCycling, setIsAutoCycling] = useState(true);
    const cycleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Auto-cycle logic
    const jumpToNext = useCallback(() => {
        if (timers.length <= 1) return;

        // Find the next active/running timer, or just cycle logically to the next index
        setActiveIndex((prev) => {
            let nextIdx = (prev + 1) % timers.length;

            // If we are auto cycling, maybe prefer timers that are actually running
            // But for simplicity and consistency, just round-robin all timers.
            // If we only cycle running timers, paused or ended ones might never show.
            // We will do a pure round-robin of all timers, bypassing strictly dismissed ones if we wanted to,
            // but pure round-robin is most predictable.

            return nextIdx;
        });
    }, [timers.length]);

    useEffect(() => {
        if (cycleTimeoutRef.current) {
            clearTimeout(cycleTimeoutRef.current);
        }

        if (isAutoCycling && timers.length > 1) {
            // Create cycle
            cycleTimeoutRef.current = setTimeout(() => {
                jumpToNext();
            }, CYCLE_INTERVAL_MS);
        }

        return () => {
            if (cycleTimeoutRef.current) {
                clearTimeout(cycleTimeoutRef.current);
            }
        };
    }, [activeIndex, isAutoCycling, timers.length, jumpToNext]);

    // Handle manual selection
    const handleSelect = (index: number) => {
        setActiveIndex(index);
        // Pause auto-cycle briefly on manual interaction? Let's just keep it cycling, 
        // but reset the 10s timer (handled implicitly by activeIndex dependency).
    };

    const toggleCycle = () => {
        setIsAutoCycling((prev) => !prev);
    };

    if (timers.length === 0) return null;

    // Safe bounds check
    const safeActiveIndex = activeIndex >= timers.length ? 0 : activeIndex;
    const activeTimer = timers[safeActiveIndex];

    return (
        <div className="flex h-full w-full">
            {/* Sidebar List */}
            <div className="w-64 flex-shrink-0 bg-black/40 border-r border-gray-800 p-4 flex flex-col gap-3 overflow-y-auto mt-14 z-20">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-gray-400 text-xs font-bold uppercase tracking-wider">All Sessions</h2>

                    <button
                        onClick={toggleCycle}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold transition-colors
                        ${isAutoCycling ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        title={isAutoCycling ? 'Auto-cycle ON (10s)' : 'Auto-cycle OFF'}
                    >
                        {isAutoCycling ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                        {isAutoCycling ? 'Auto' : 'Manual'}
                    </button>
                </div>

                {timers.map((timer, idx) => (
                    <MiniTimerCard
                        key={timer.id}
                        timer={timer}
                        settings={settings}
                        isActive={idx === safeActiveIndex}
                        onClick={() => handleSelect(idx)}
                    />
                ))}
            </div>

            {/* Main Content (Center Staged) */}
            <div className="flex-1 p-6 flex flex-col items-center justify-center relative overflow-hidden mt-10">
                <div className="w-full h-full max-w-6xl max-h-[800px] transition-all duration-500 pb-10">
                    <TimerCard
                        timer={activeTimer}
                        settings={settings}
                        timerCount={1} // Force maximum scaling size clamp
                        {...actions}
                    />
                </div>
            </div>
        </div>
    );
}

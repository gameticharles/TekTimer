import { useState, useEffect, useCallback, useRef } from 'react';
import type { ExamTimer, AppSettings } from '../lib/types';
import TimerCard from './TimerCard';
import MiniTimerCard from './MiniTimerCard';
import { Pause, Play } from 'lucide-react';

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
}

const CYCLE_INTERVAL_MS = 10000; // 10 seconds

export default function CenterStageView({
    timers,
    settings,
    controlsVisible,
    onReorder,
    ...actions
}: CenterStageViewProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isAutoCycling, setIsAutoCycling] = useState(true);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const cycleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Auto-cycle logic
    const jumpToNext = useCallback(() => {
        if (timers.length <= 1) return;

        // Find the next active/running timer, or just cycle logically to the next index
        setActiveIndex((prev) => {
            if (timers.length <= 1) return prev;

            let nextIdx = (prev + 1) % timers.length;

            if (settings.ignoreCompletedInCenterStage) {
                // Find next that is not 'Ended'
                let attempts = 0;
                while (timers[nextIdx].status === 'Ended' && attempts < timers.length) {
                    nextIdx = (nextIdx + 1) % timers.length;
                    attempts++;
                }

                // If all are ended, just stay where we are or let it settle on 0
                if (attempts >= timers.length) {
                    return 0;
                }
            }

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

    // Fast-forward if current is ended and setting is enabled
    useEffect(() => {
        if (!settings.ignoreCompletedInCenterStage || timers.length <= 1) return;

        const safeActiveIndex = activeIndex >= timers.length ? 0 : activeIndex;
        if (timers[safeActiveIndex]?.status === 'Ended') {
            // If there's at least one non-ended timer, jump to it
            const hasActive = timers.some(t => t.status !== 'Ended');
            if (hasActive) {
                jumpToNext();
            }
        }
    }, [activeIndex, timers, settings.ignoreCompletedInCenterStage, jumpToNext]);

    // Handle manual selection
    const handleSelect = (index: number) => {
        setActiveIndex(index);
        // Pause auto-cycle briefly on manual interaction? Let's just keep it cycling, 
        // but reset the 10s timer (handled implicitly by activeIndex dependency).
    };

    const toggleCycle = () => {
        setIsAutoCycling((prev) => !prev);
    };

    // ── Drag & Drop ───────────────────────────────────────────────────
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (draggedId && draggedId !== targetId) {

            // Adjust activeIndex if we are dragging the currently active timer
            // or if we are dragging something before/after it to keep the same timer in focus
            // (Handled implicitly by React re-renders for now)

            onReorder(draggedId, targetId);

            // If the user wants to stay on the same timer, they can manually select it.
            // But we don't strictly need to do index math here because the reorder triggers a re-render
            // with a new array.
        }
        setDraggedId(null);
    };

    if (timers.length === 0) return null;

    // Safe bounds check
    const safeActiveIndex = activeIndex >= timers.length ? 0 : activeIndex;
    const activeTimer = timers[safeActiveIndex];

    return (
        <div className="flex h-full w-full relative">
            {/* Sidebar List */}
            <div className={`absolute left-0 top-0 bottom-0 w-64 bg-gray-950/90 backdrop-blur-md border-r border-gray-800 p-4 pt-16 flex flex-col gap-3 overflow-y-auto z-20 transition-transform duration-500 ${controlsVisible ? 'translate-x-0' : '-translate-x-full'}`}>
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
                    <div
                        key={timer.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, timer.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, timer.id)}
                        onDragEnd={() => setDraggedId(null)}
                        style={{ opacity: draggedId === timer.id ? 0.4 : 1 }}
                        className="transition-opacity"
                    >
                        <MiniTimerCard
                            timer={timer}
                            settings={settings}
                            isActive={idx === safeActiveIndex}
                            onClick={() => handleSelect(idx)}
                        />
                    </div>
                ))}
            </div>

            {/* Main Content (Center Staged) */}
            <div className="flex-1 p-6 flex flex-col relative overflow-hidden mt-10">
                <div className="w-full h-full transition-all duration-500 pb-10 [&>div]:h-full">
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

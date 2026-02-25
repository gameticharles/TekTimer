import { useState, useEffect, useCallback } from 'react';
import {
    Plus, Pause, Play, Moon, Settings, Maximize, Minimize, ArrowLeft, LayoutGrid, Presentation, Mic
} from 'lucide-react';
import TimerCard from '../components/TimerCard';
import AddExamTimerModal from '../components/AddExamTimerModal';
import EditExamTimerModal from '../components/EditExamTimerModal';
import ExtraTimeModal from '../components/ExtraTimeModal';
import EmptyState from '../components/EmptyState';
import BlackoutScreen from '../components/BlackoutScreen';
import CenterStageView from '../components/CenterStageView';
import AnnouncementModal from '../components/AnnouncementModal';
import type { AppSettings, ExamTimer } from '../lib/types';
import { useTimerStore } from '../hooks/useTimerStore';
import { useFullscreen } from '../hooks/useFullscreen';
import { useBlackout } from '../hooks/useBlackout';
import { useIdleControls } from '../hooks/useIdleControls';
import { audioManager } from '../lib/audioManager';
import { getGridClass, getCardSpanClass } from '../lib/gridLayout';

interface ExamScreenProps {
    settings: AppSettings;
    onUpdateSettings: (patch: Partial<AppSettings>) => void;
    onExit: () => void;
    onSettings: () => void;
}

export default function ExamScreen({ settings, onExit, onSettings }: ExamScreenProps) {
    const [showAddModal, setShowAddModal] = useState(false);
    const [editTimerId, setEditTimerId] = useState<string | null>(null);
    const [extraTimeTimerId, setExtraTimeTimerId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'center'>('grid');
    const [showAnnounceModal, setShowAnnounceModal] = useState(false);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const { isFullscreen, toggle: toggleFullscreen, exit: exitFullscreen } = useFullscreen();
    const { isBlackout, enableBlackout, disableBlackout } = useBlackout();
    const { controlsVisible } = useIdleControls();
    const store = useTimerStore(settings);

    const examTimers = store.timers as ExamTimer[];
    const hasRunning = examTimers.some((t) => t.status === 'Running');
    const hasPaused = examTimers.some((t) => t.status === 'Paused');

    // Audio integration for all timers
    useEffect(() => {
        for (const timer of examTimers) {
            if (timer.status === 'Ended' && !timer.isDismissed && settings.soundEnabled) {
                audioManager.play(timer.id, settings.customAlarmPath, settings.alarmVolume);
            } else {
                audioManager.stop(timer.id);
            }
        }
        return () => audioManager.stopAll();
    }, [examTimers.map((t) => `${t.id}-${t.status}-${t.isDismissed}`).join(',')]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
            ) return;

            if (e.key === 'Escape') { exitFullscreen(); return; }
            if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); return; }
            if (e.key === 'n' || e.key === 'N') {
                if (examTimers.length < 5) setShowAddModal(true);
                return;
            }
            if (e.key === 'p' && !e.shiftKey) { store.pauseAll(); return; }
            if (e.key === 'P' && e.shiftKey) { store.resumeAll(); return; }
            if (e.key === 'v' || e.key === 'V') {
                setViewMode((prev) => (prev === 'grid' ? 'center' : 'grid'));
                return;
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [examTimers.length, store, exitFullscreen, toggleFullscreen]);

    const handleExit = useCallback(async () => {
        audioManager.stopAll();
        await store.clearAll();
        onExit();
    }, [store, onExit]);

    const handleAddTimer = useCallback(
        async (courseCode: string, program: string, studentCount: number, durationSeconds: number) => {
            await store.createExamTimer(courseCode, program, studentCount, durationSeconds);
        },
        [store],
    );

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
            store.reorderTimers(draggedId, targetId);
        }
        setDraggedId(null);
    };

    if (isBlackout) {
        return <BlackoutScreen onReveal={disableBlackout} />;
    }

    // Empty state
    if (examTimers.length === 0) {
        return (
            <div className="relative">
                <EmptyState onAddTimer={() => setShowAddModal(true)} />
                {/* Toolbar even in empty state */}
                <div className={`absolute top-0 left-0 right-0 px-4 py-3 flex items-center justify-between
                         transition-all duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
                    <button
                        onClick={handleExit}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-white 
                       hover:bg-white/10 transition-all text-sm"
                    >
                        <ArrowLeft size={16} />
                        Exit
                    </button>
                </div>
                {showAddModal && (
                    <AddExamTimerModal
                        onAdd={handleAddTimer}
                        onClose={() => setShowAddModal(false)}
                        timerCount={0}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="h-screen w-screen relative overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors">
            {/* Toolbar */}
            <div
                className={`absolute top-0 left-0 right-0 z-30 px-4 py-2 flex items-center justify-between
                    bg-gradient-to-b from-white/90 dark:from-black/80 to-transparent transition-all duration-300
                    ${controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}
            >
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExit}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white 
                       hover:bg-gray-900/10 dark:hover:bg-white/10 transition-all text-sm"
                    >
                        <ArrowLeft size={16} />
                        Exit
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {/* Pause All / Resume All */}
                    <button
                        onClick={() => store.pauseAll()}
                        disabled={!hasRunning}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                       text-gray-300 hover:text-white hover:bg-white/10 transition-all
                       disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Pause All (P)"
                    >
                        <Pause size={14} />
                        Pause All
                    </button>
                    <button
                        onClick={() => store.resumeAll()}
                        disabled={!hasPaused}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                       text-gray-300 hover:text-white hover:bg-white/10 transition-all
                       disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Resume All (Shift+P)"
                    >
                        <Play size={14} fill="currentColor" />
                        Resume All
                    </button>

                    <div className="w-px h-5 bg-gray-700" />

                    {/* View Toggle */}
                    <button
                        onClick={() => setViewMode((prev) => (prev === 'grid' ? 'center' : 'grid'))}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                       text-gray-300 hover:text-white hover:bg-white/10 transition-all"
                        title="Toggle View (V)"
                    >
                        {viewMode === 'grid' ? <Presentation size={14} /> : <LayoutGrid size={14} />}
                        {viewMode === 'grid' ? 'Center Stage' : 'Grid Layout'}
                    </button>

                    <div className="w-px h-5 bg-gray-700 mx-1" />

                    {/* Add Timer */}
                    <button
                        onClick={() => setShowAddModal(true)}
                        disabled={examTimers.length >= 5}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                       text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-900/10 dark:hover:bg-white/10 transition-all
                       disabled:opacity-30 disabled:cursor-not-allowed"
                        title={examTimers.length >= 5 ? 'Maximum 5 sessions reached' : 'Add Timer (N)'}
                    >
                        <Plus size={14} />
                        Add
                    </button>

                    <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />

                    {/* Announce */}
                    <button
                        onClick={() => setShowAnnounceModal(true)}
                        disabled={examTimers.length === 0}
                        className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-900/10 dark:hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Manual Announcement"
                    >
                        <Mic size={16} />
                    </button>

                    {/* Blackout */}
                    <button
                        onClick={enableBlackout}
                        className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-900/10 dark:hover:bg-white/10 transition-all"
                        title="Blackout (B)"
                    >
                        <Moon size={16} />
                    </button>

                    {/* Settings */}
                    <button
                        onClick={onSettings}
                        className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-900/10 dark:hover:bg-white/10 transition-all"
                    >
                        <Settings size={16} />
                    </button>

                    {/* Fullscreen */}
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-900/10 dark:hover:bg-white/10 transition-all"
                    >
                        {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {viewMode === 'grid' ? (
                <div className={getGridClass(examTimers.length) + ' gap-2 p-2 pt-14'}>
                    {examTimers.map((timer, index) => (
                        <div
                            key={timer.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, timer.id)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, timer.id)}
                            onDragEnd={() => setDraggedId(null)}
                            className={getCardSpanClass(index, examTimers.length) + ' h-full min-h-0 transition-opacity'}
                            style={{ opacity: draggedId === timer.id ? 0.4 : 1 }}
                        >
                            <TimerCard
                                timer={timer}
                                settings={settings}
                                timerCount={examTimers.length}
                                onStart={store.startTimer}
                                onPause={store.pauseTimer}
                                onReset={store.resetTimer}
                                onDelete={store.deleteTimer}
                                onEdit={setEditTimerId}
                                onDismiss={store.dismissTimer}
                                onAddExtraTime={setExtraTimeTimerId}
                                onFontSizeChange={(id, scale) => store.setFontSizeOverride(id, scale)}
                                onFontSizeReset={(id) => store.setFontSizeOverride(id, null)}
                                onUpdateSchedule={(id, s) => store.updateAnnouncementSchedule(id, s)}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <CenterStageView
                    timers={examTimers}
                    settings={settings}
                    controlsVisible={controlsVisible}
                    onStart={store.startTimer}
                    onPause={store.pauseTimer}
                    onReset={store.resetTimer}
                    onDelete={store.deleteTimer}
                    onEdit={setEditTimerId}
                    onDismiss={store.dismissTimer}
                    onReorder={store.reorderTimers}
                    onAddExtraTime={setExtraTimeTimerId}
                    onFontSizeChange={(id, scale) => store.setFontSizeOverride(id, scale)}
                    onFontSizeReset={(id) => store.setFontSizeOverride(id, null)}
                />
            )}

            {/* Modals */}
            {showAddModal && (
                <AddExamTimerModal
                    onAdd={handleAddTimer}
                    onClose={() => setShowAddModal(false)}
                    timerCount={examTimers.length}
                />
            )}

            {editTimerId && (
                <EditExamTimerModal
                    timer={examTimers.find(t => t.id === editTimerId)!}
                    onUpdate={store.updateExamTimer}
                    onClose={() => setEditTimerId(null)}
                />
            )}

            {extraTimeTimerId && (
                <ExtraTimeModal
                    timerLabel={
                        examTimers.find((t) => t.id === extraTimeTimerId)?.label ?? 'Timer'
                    }
                    onAddTime={(seconds) => {
                        store.addExtraTime(extraTimeTimerId, seconds);
                        setExtraTimeTimerId(null);
                    }}
                    onClose={() => setExtraTimeTimerId(null)}
                />
            )}

            {showAnnounceModal && (
                <AnnouncementModal
                    settings={settings}
                    timers={examTimers}
                    onClose={() => setShowAnnounceModal(false)}
                />
            )}
        </div>
    );
}

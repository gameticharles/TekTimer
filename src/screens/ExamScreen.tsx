import { useState, useEffect, useCallback } from 'react';
import {
    Plus, Pause, Play, Moon, Settings, Maximize, Minimize, ArrowLeft, LayoutGrid, Presentation, Mic, Power
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
            {/* Toolbar (Only for Grid View) */}
            {viewMode === 'grid' && (
                <div
                    className={`absolute top-0 left-0 right-0 z-30 px-6 py-4 flex items-center justify-between
                        bg-white/90 dark:bg-black/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 transition-all duration-300
                        ${controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}
                >
                    {/* Left Side: Title & Subtitle */}
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-sm shadow-blue-500/20">
                            <LayoutGrid size={22} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">Exam Mode</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                {examTimers.length} Active {examTimers.length === 1 ? 'Exam' : 'Exams'}
                            </p>
                        </div>
                    </div>

                    {/* Right Side: Actions */}
                    <div className="flex items-center gap-2">
                        {/* Pause All */}
                        <button
                            onClick={() => store.pauseAll()}
                            disabled={!hasRunning}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-xl font-bold text-sm hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-40"
                            title="Pause All (P)"
                        >
                            <Pause size={16} fill="currentColor" />
                            <span className="hidden xl:inline">Pause All</span>
                        </button>

                        {/* Resume All */}
                        <button
                            onClick={() => store.resumeAll()}
                            disabled={!hasPaused}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-xl font-bold text-sm hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-40"
                            title="Resume All (Shift+P)"
                        >
                            <Play size={16} fill="currentColor" />
                            <span className="hidden xl:inline">Resume All</span>
                        </button>

                        <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-2 hidden md:block" />

                        {/* Add Timer */}
                        <button
                            onClick={() => setShowAddModal(true)}
                            disabled={examTimers.length >= 5}
                            className="p-2.5 rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 hidden md:block"
                            title={examTimers.length >= 5 ? 'Maximum 5 sessions reached' : 'Add Timer (N)'}
                        >
                            <Plus size={18} />
                        </button>

                        {/* Announce */}
                        {settings.announcementsEnabled && (
                            <button
                                onClick={() => setShowAnnounceModal(true)}
                                disabled={examTimers.length === 0}
                                className="p-2.5 rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 hidden md:block"
                                title="Manual Announcement"
                            >
                                <Mic size={18} />
                            </button>
                        )}

                        {/* Fullscreen */}
                        <button
                            onClick={toggleFullscreen}
                            className="p-2.5 rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors hidden sm:block"
                            title="Toggle Fullscreen (F11)"
                        >
                            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                        </button>

                        {/* View Toggle */}
                        <button
                            onClick={() => setViewMode((prev) => (prev === 'grid' ? 'center' : 'grid'))}
                            className="p-2.5 rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            title="Toggle View (V)"
                        >
                            {viewMode === 'grid' ? <Presentation size={18} /> : <LayoutGrid size={18} />}
                        </button>

                        <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1 hidden sm:block" />

                        {/* Settings */}
                        <button
                            onClick={onSettings}
                            className="p-2.5 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-white dark:hover:bg-gray-800 transition-all hidden sm:block"
                            title="Settings"
                        >
                            <Settings size={18} />
                        </button>

                        {/* Blackout */}
                        <button
                            onClick={enableBlackout}
                            className="p-2.5 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-white dark:hover:bg-gray-800 transition-all hidden lg:block"
                            title="Blackout (B)"
                        >
                            <Moon size={18} />
                        </button>

                        {/* Exit */}
                        <button
                            onClick={handleExit}
                            className="p-2.5 rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors ml-1"
                            title="Exit UI"
                        >
                            <Power size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Content Area */}
            {viewMode === 'grid' ? (
                <div className={getGridClass(examTimers.length) + ' gap-4 p-4 pt-24 pb-20'}>
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
                    onToggleView={() => setViewMode('grid')}
                    onExit={handleExit}
                    onSettings={onSettings}
                    onToggleFullscreen={toggleFullscreen}
                    isFullscreen={isFullscreen}
                    onAnnounce={() => setShowAnnounceModal(true)}
                />
            )}

            {/* Status Legend */}
            {viewMode === 'grid' && (
                <div className={`absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-gray-200 dark:border-gray-800 px-6 py-2.5 rounded-full shadow-xl flex items-center gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                            <span className="text-[11px] font-bold tracking-wider text-gray-600 dark:text-gray-300">NORMAL</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse" />
                            <span className="text-[11px] font-bold tracking-wider text-gray-600 dark:text-gray-300">WARNING</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                            <span className="text-[11px] font-bold tracking-wider text-gray-600 dark:text-gray-300">CRITICAL</span>
                        </div>
                    </div>
                </div>
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

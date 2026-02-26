import { useState, useEffect, useCallback } from 'react';
import QuizSetupModal from '../components/QuizSetupModal';
import QuizTimerDisplay from '../components/QuizTimer';
import ControlBar from '../components/ControlBar';
import BlackoutScreen from '../components/BlackoutScreen';
import AnnouncementModal from '../components/AnnouncementModal';
import EditQuizTimerModal from '../components/EditQuizTimerModal';
import type { AppSettings, QuizTimer } from '../lib/types';
import { useFullscreen } from '../hooks/useFullscreen';
import { useIdleControls } from '../hooks/useIdleControls';
import { useBlackout } from '../hooks/useBlackout';
import { useTimerStore } from '../hooks/useTimerStore';
import { audioManager } from '../lib/audioManager';
import { SCALE_STEP } from '../lib/fontSizeUtils';

interface QuizScreenProps {
    settings: AppSettings;
    onUpdateSettings: (patch: Partial<AppSettings>) => void;
    onExit: () => void;
    onSettings: () => void;
}

export default function QuizScreen({ settings, onUpdateSettings, onExit, onSettings }: QuizScreenProps) {
    const [showSetup, setShowSetup] = useState(true);
    const [showAnnounceModal, setShowAnnounceModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const { isFullscreen, toggle: toggleFullscreen, exit: exitFullscreen } = useFullscreen();
    const { controlsVisible } = useIdleControls();
    const { isBlackout, enableBlackout, disableBlackout } = useBlackout();
    const store = useTimerStore(settings);

    const timer = store.timers[0] as QuizTimer | undefined;

    // Handle timer creation
    const handleStart = useCallback(
        async (label: string, durationSeconds: number, startImmediately: boolean) => {
            await store.createQuizTimer(label, durationSeconds, startImmediately);
            setShowSetup(false);
        },
        [store],
    );

    // Audio integration
    useEffect(() => {
        if (timer?.status === 'Ended' && !timer.isDismissed && settings.soundEnabled) {
            audioManager.play(timer.id, settings.customAlarmPath, settings.alarmVolume);
        } else if (timer) {
            audioManager.stop(timer.id);
        }
        return () => {
            if (timer) audioManager.stop(timer.id);
        };
    }, [timer?.status, timer?.isDismissed, settings.soundEnabled]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Don't trigger on inputs
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
            ) return;

            if (e.key === 'Escape') {
                exitFullscreen();
                return;
            }
            if (e.key === 'F11') {
                e.preventDefault();
                toggleFullscreen();
                return;
            }

            if (!timer || showSetup) return;

            if (e.key === ' ') {
                e.preventDefault();
                if (timer.status === 'Running') store.pauseTimer(timer.id);
                else if (timer.status === 'Paused' || timer.status === 'Idle') store.startTimer(timer.id);
            }
            if (e.key === 'r' || e.key === 'R') {
                if (timer.status !== 'Idle') store.resetTimer(timer.id);
            }
            if (e.key === '+' || e.key === '=') {
                onUpdateSettings({ globalFontScale: Math.min(200, settings.globalFontScale + SCALE_STEP) });
            }
            if (e.key === '-') {
                onUpdateSettings({ globalFontScale: Math.max(50, settings.globalFontScale - SCALE_STEP) });
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [timer, showSetup, settings.globalFontScale, store, exitFullscreen, toggleFullscreen, onUpdateSettings]);

    // Handle exit — clean up timers
    const handleExit = useCallback(async () => {
        audioManager.stopAll();
        await store.clearAll();
        onExit();
    }, [store, onExit]);

    if (isBlackout) {
        return <BlackoutScreen onReveal={disableBlackout} />;
    }

    return (
        <div className="h-screen w-screen relative overflow-hidden bg-white dark:bg-gray-950 transition-colors">
            {/* Setup Modal */}
            {showSetup && (
                <QuizSetupModal
                    onStart={handleStart}
                    onClose={handleExit}
                />
            )}

            {/* Timer Display */}
            {timer && !showSetup && (
                <>
                    <QuizTimerDisplay timer={timer} settings={settings} />

                    {/* Control Bar */}
                    <ControlBar
                        status={timer.status}
                        isFullscreen={isFullscreen}
                        visible={controlsVisible}
                        onStart={() => store.startTimer(timer.id)}
                        onPause={() => store.pauseTimer(timer.id)}
                        onReset={() => store.resetTimer(timer.id)}
                        onToggleFullscreen={toggleFullscreen}
                        onBlackout={enableBlackout}
                        onAnnounce={() => setShowAnnounceModal(true)}
                        onIncreaseFontSize={() =>
                            onUpdateSettings({ globalFontScale: Math.min(200, settings.globalFontScale + SCALE_STEP) })
                        }
                        onDecreaseFontSize={() =>
                            onUpdateSettings({ globalFontScale: Math.max(50, settings.globalFontScale - SCALE_STEP) })
                        }
                        onSettings={onSettings}
                        onExit={handleExit}
                        onEdit={() => setShowEditModal(true)}
                        onAddExtraTime={(seconds) => store.addExtraTime(timer.id, seconds)}
                    />
                </>
            )}

            {/* Empty state when no setup and no timer */}
            {!timer && !showSetup && (
                <div className="h-full w-full flex items-center justify-center">
                    <p className="text-gray-500 text-lg">No timer configured</p>
                </div>
            )}

            {/* Modals */}
            {showAnnounceModal && timer && (
                <AnnouncementModal
                    settings={settings}
                    timers={[timer]}
                    onClose={() => setShowAnnounceModal(false)}
                />
            )}

            {showEditModal && timer && (
                <EditQuizTimerModal
                    timer={timer}
                    onUpdate={(label, duration) => store.updateQuizTimer(timer.id, { label, durationSeconds: duration })}
                    onClose={() => setShowEditModal(false)}
                />
            )}
        </div>
    );
}

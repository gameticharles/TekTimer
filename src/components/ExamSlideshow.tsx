import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, ChevronLeft, ChevronRight, ImageOff, Play, Repeat } from 'lucide-react';
import type { AppSettings, ExamTimer, MediaSlide, SlidePhase } from '../lib/types';

interface ExamSlideshowProps {
    settings: AppSettings;
    timers: ExamTimer[];
    isManuallyShown: boolean;
    onManualDismiss: () => void;
}

// ── Phase helpers ──────────────────────────────────────────────────────────────

function getExamPhase(timers: ExamTimer[], startMinutes: number, endMinutes: number): SlidePhase {
    const active = timers.filter(t => t.status === 'Running' || t.status === 'Paused' || t.status === 'Idle');
    if (active.length === 0) return 'middle';
    const ref = active.reduce((a, b) => b.durationSeconds > a.durationSeconds ? b : a, active[0]);
    const elapsed = ref.durationSeconds - ref.remainingSeconds;
    if (elapsed / 60 < startMinutes) return 'start';
    if (ref.remainingSeconds / 60 <= endMinutes) return 'end';
    return 'middle';
}

function getSlidesForPhase(media: MediaSlide[], phase: SlidePhase): MediaSlide[] {
    return media.filter(m => m.phases.includes(phase));
}

function isPhaseEnabled(phase: SlidePhase, settings: AppSettings): boolean {
    if (phase === 'start') return settings.slideshowPhaseStart ?? true;
    if (phase === 'middle') return settings.slideshowPhaseMiddle ?? true;
    return settings.slideshowPhaseEnd ?? true;
}

// ── Image cache ────────────────────────────────────────────────────────────────

/** Per-session image cache: path → base64 data URL */
const srcCache = new Map<string, string>();

function useMediaSrc(slide: MediaSlide | null): string | null {
    const [src, setSrc] = useState<string | null>(() =>
        slide ? srcCache.get(slide.path) ?? null : null
    );

    useEffect(() => {
        if (!slide) { setSrc(null); return; }
        const cached = srcCache.get(slide.path);
        if (cached) { setSrc(cached); return; }

        let cancelled = false;
        invoke<string>('read_file_as_base64', { filePath: slide.path })
            .then(dataUrl => {
                if (!cancelled) {
                    srcCache.set(slide.path, dataUrl);
                    setSrc(dataUrl);
                }
            })
            .catch(err => {
                console.error('ExamSlideshow: failed to load', slide.path, err);
            });
        return () => { cancelled = true; };
    }, [slide?.path]);

    return src;
}

// ── Play-mode type ─────────────────────────────────────────────────────────────

type PlayMode = 'idle' | 'cycle' | 'infinite';

// ── Main component ─────────────────────────────────────────────────────────────

export default function ExamSlideshow({ settings, timers, isManuallyShown, onManualDismiss }: ExamSlideshowProps) {
    const {
        slideshowEnabled, slideshowOpacity,
        slideshowSlideDuration, slideshowPauseDuration, slideshowCycles,
        slideshowPhaseStartMinutes, slideshowPhaseEndMinutes, slideshowMedia,
    } = settings;

    // ── Derived slide set ──────────────────────────────────────────────────
    const phase = getExamPhase(timers, slideshowPhaseStartMinutes, slideshowPhaseEndMinutes);
    const phaseSlides = getSlidesForPhase(slideshowMedia, phase);
    const slides = isManuallyShown ? slideshowMedia : phaseSlides;

    // ── Core state ─────────────────────────────────────────────────────────
    const [playMode, setPlayMode]       = useState<PlayMode>('idle');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [cyclesLeft, setCyclesLeft]   = useState(0);
    /** true = showing the black overlay; false = showing the grid gap (pause) */
    const [overlayVisible, setOverlayVisible] = useState(false);
    /** true = in the inter-slide pause gap */
    const [isPausing, setIsPausing]     = useState(false);
    /** Whether the image has faded in */
    const [imgVisible, setImgVisible]   = useState(false);

    // ── Refs ───────────────────────────────────────────────────────────────
    const seqTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevPhaseRef  = useRef<SlidePhase | null>(null);
    const playModeRef   = useRef<PlayMode>('idle');

    // Keep ref in sync so callbacks don't get stale
    playModeRef.current = playMode;

    // ── Prefetch ───────────────────────────────────────────────────────────
    const safeIndex  = slides.length > 0 ? currentIndex % slides.length : 0;
    const currentSlide = slides[safeIndex] ?? null;
    const nextSlide  = slides.length > 1 ? slides[(safeIndex + 1) % slides.length] : null;

    const mediaSrc = useMediaSrc(playMode !== 'idle' && !isPausing ? currentSlide : null);
    useMediaSrc(nextSlide); // background prefetch

    // ── Sequence engine ────────────────────────────────────────────────────

    const clearSeqTimer = useCallback(() => {
        if (seqTimerRef.current) { clearTimeout(seqTimerRef.current); seqTimerRef.current = null; }
    }, []);

    /**
     * Advance to the next slide.
     * idx      = current index
     * cLeft    = cycles remaining AFTER the current one (pre-decremented for wrap)
     * mode     = play mode to use for continuation
     */
    const scheduleNext = useCallback((idx: number, cLeft: number, mode: PlayMode) => {
        clearSeqTimer();
        if (slides.length === 0 || mode === 'idle') return;

        // Show image for slideDuration seconds
        seqTimerRef.current = setTimeout(() => {
            // Fade out image, begin pause gap
            setImgVisible(false);
            setIsPausing(true);

            seqTimerRef.current = setTimeout(() => {
                // End pause gap
                setIsPausing(false);

                const nextIdx = (idx + 1) % slides.length;
                const wrapped = nextIdx === 0; // completed a full cycle

                let nextCycles = cLeft;
                if (wrapped && mode === 'cycle') {
                    nextCycles = cLeft - 1;
                    if (nextCycles <= 0) {
                        // All cycles done — stop
                        setPlayMode('idle');
                        setOverlayVisible(false);
                        setCurrentIndex(0);
                        return;
                    }
                }

                setCyclesLeft(nextCycles);
                setCurrentIndex(nextIdx);
                // scheduleNext will be re-triggered by the useEffect that watches currentIndex / playMode
            }, (slideshowPauseDuration ?? 5) * 1000);
        }, (slideshowSlideDuration ?? 5) * 1000);
    }, [slides.length, slideshowSlideDuration, slideshowPauseDuration, clearSeqTimer]);

    // ── Start a fresh run ──────────────────────────────────────────────────

    const startRun = useCallback((mode: PlayMode, cycles: number) => {
        clearSeqTimer();
        setCurrentIndex(0);
        setCyclesLeft(cycles);
        setIsPausing(false);
        setImgVisible(false);
        setOverlayVisible(true);
        setPlayMode(mode);
    }, [clearSeqTimer]);

    const stopRun = useCallback(() => {
        clearSeqTimer();
        setImgVisible(false);
        // Brief delay so image fades out before overlay disappears
        setTimeout(() => {
            setOverlayVisible(false);
            setPlayMode('idle');
            setIsPausing(false);
            setCurrentIndex(0);
        }, 400);
    }, [clearSeqTimer]);

    // ── Drive sequence whenever index / playMode changes ───────────────────

    useEffect(() => {
        if (playMode === 'idle' || isPausing) return;
        if (slides.length === 0) return;
        scheduleNext(safeIndex, cyclesLeft, playMode);
        return clearSeqTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex, playMode]);

    // ── Fade image in once src is ready ───────────────────────────────────

    useEffect(() => {
        if (mediaSrc && playMode !== 'idle' && !isPausing) {
            const t = setTimeout(() => setImgVisible(true), 50);
            return () => clearTimeout(t);
        } else {
            setImgVisible(false);
        }
    }, [mediaSrc, playMode, isPausing]);

    // ── Phase-transition auto-start ────────────────────────────────────────

    useEffect(() => {
        if (!slideshowEnabled || slides.length === 0) return;
        if (isManuallyShown) return; // manual takes priority

        // Only react to phase transitions once an exam is actually running.
        // A freshly-created Idle timer has elapsed=0, which would falsely
        // match the 'start' phase window and trigger a premature cycle run.
        const examActive = timers.some(t => t.status === 'Running' || t.status === 'Paused');
        if (!examActive) {
            // Keep prevPhaseRef in sync so the first real start triggers correctly
            prevPhaseRef.current = phase;
            return;
        }

        const prevPhase = prevPhaseRef.current;
        prevPhaseRef.current = phase;

        if (phase === prevPhase) return; // no transition yet

        if (isPhaseEnabled(phase, settings) && playModeRef.current === 'idle') {
            // New phase window opened and this phase is enabled → fire
            startRun('cycle', slideshowCycles ?? 3);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, timers]);

    // ── Manual trigger ─────────────────────────────────────────────────────

    useEffect(() => {
        if (!isManuallyShown) return;

        // Infinite only when no timer has started yet (all still Idle).
        // If any timer has been started (Running, Paused, or Ended) → finite cycles.
        const allIdle = timers.every(t => t.status === 'Idle');
        if (allIdle) {
            startRun('infinite', 0);
        } else {
            startRun('cycle', slideshowCycles ?? 3);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isManuallyShown]);

    // ── Dismiss ────────────────────────────────────────────────────────────

    const handleDismiss = useCallback(() => {
        stopRun();
        if (isManuallyShown) onManualDismiss();
    }, [stopRun, isManuallyShown, onManualDismiss]);

    // ── Manual navigation ──────────────────────────────────────────────────

    const goNext = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        clearSeqTimer();
        setImgVisible(false);
        setIsPausing(false);
        setCurrentIndex(prev => (prev + 1) % slides.length);
    }, [slides.length, clearSeqTimer]);

    const goPrev = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        clearSeqTimer();
        setImgVisible(false);
        setIsPausing(false);
        setCurrentIndex(prev => (prev - 1 + slides.length) % slides.length);
    }, [slides.length, clearSeqTimer]);

    // ── Render guard ───────────────────────────────────────────────────────
    // During isPausing: return null so the overlay fully unmounts and the
    // timer grid shows through completely (no blur, no dimming).

    if (!overlayVisible || !currentSlide || isPausing) return null;

    const backdropAlpha = slideshowOpacity / 100;
    const cycleLabel    = playMode === 'infinite'
        ? '∞'
        : playMode === 'cycle'
            ? `${cyclesLeft} cycle${cyclesLeft !== 1 ? 's' : ''} left`
            : '';

    return (
        <div
            className={`absolute inset-0 z-40 transition-opacity duration-500 ease-in-out ${overlayVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={handleDismiss}
        >
            {/* ── Blurred backdrop ── */}
            <div
                className="absolute inset-0 backdrop-blur-2xl"
                style={{ backgroundColor: `rgba(0, 0, 0, ${backdropAlpha})` }}
            />

            {/* ── Image ── */}
            <div className={`absolute inset-0 flex items-center justify-center p-10 pointer-events-none transition-opacity duration-400 ${imgVisible ? 'opacity-100' : 'opacity-0'}`}>
                {mediaSrc && (
                    currentSlide.type === 'image' ? (
                        <img
                            key={currentSlide.id}
                            src={mediaSrc}
                            alt={currentSlide.name}
                            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                            draggable={false}
                        />
                    ) : (
                        <video
                            key={currentSlide.id}
                            src={mediaSrc}
                            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                            autoPlay
                            loop
                            muted
                        />
                    )
                )}
            </div>


            {/* ── Controls ── */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {/* Top bar */}
                <div className="flex justify-between items-center p-4 pointer-events-auto">
                    {/* Mode / cycles badge */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm border shadow-lg
                        ${playMode === 'infinite'
                            ? 'bg-white/25 text-white border-white/30'
                            : 'bg-black/40 text-white/80 border-white/15'}`}
                    >
                        {playMode === 'infinite'
                            ? <><Play size={12} className="shrink-0" /> Infinite</>
                            : <><Repeat size={12} className="shrink-0" /> {cycleLabel}</>
                        }
                    </div>

                    {/* Dismiss */}
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
                        className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2.5 backdrop-blur-sm transition-all shadow-lg border border-white/20"
                        title="Dismiss slideshow"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Navigation: dots + arrows */}
                {slides.length > 1 && (
                    <div className="flex items-center justify-center gap-3 pb-2 pointer-events-auto">
                        <button
                            onClick={goPrev}
                            className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 backdrop-blur-sm transition-all border border-white/20"
                        >
                            <ChevronLeft size={18} />
                        </button>

                        <div className="flex items-center gap-2">
                            {slides.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        clearSeqTimer();
                                        setImgVisible(false);
                                        setIsPausing(false);
                                        setCurrentIndex(i);
                                    }}
                                    className={`rounded-full transition-all ${i === safeIndex
                                        ? 'w-5 h-2.5 bg-white shadow-sm'
                                        : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/70'
                                        }`}
                                />
                            ))}
                        </div>

                        <button
                            onClick={goNext}
                            className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 backdrop-blur-sm transition-all border border-white/20"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                )}
            </div>

            {/* Phase / slide counter */}
            <div className="absolute bottom-4 right-4 text-[10px] font-bold tracking-widest text-white/50 uppercase pointer-events-none flex items-center gap-1">
                {isManuallyShown ? 'Manual' : phase} · {safeIndex + 1}/{slides.length}
            </div>
        </div>
    );
}

export function SlideshowNoMediaHint() {
    return (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-2 opacity-30">
                <ImageOff size={40} className="text-gray-400" />
                <span className="text-xs text-gray-400 font-medium">No slides for this phase</span>
            </div>
        </div>
    );
}

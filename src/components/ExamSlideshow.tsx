import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, ChevronLeft, ChevronRight, ImageOff, Pause, Play } from 'lucide-react';
import type { AppSettings, ExamTimer, MediaSlide, SlidePhase } from '../lib/types';

interface ExamSlideshowProps {
    settings: AppSettings;
    timers: ExamTimer[];
    isManuallyShown: boolean;
    onManualDismiss: () => void;
}

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

export default function ExamSlideshow({ settings, timers, isManuallyShown, onManualDismiss }: ExamSlideshowProps) {
    const {
        slideshowEnabled, slideshowOpacity, slideshowSlideDuration,
        slideshowPhaseStartMinutes, slideshowPhaseEndMinutes, slideshowMedia,
    } = settings;

    const [currentIndex, setCurrentIndex] = useState(0);
    const [visible, setVisible] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);
    const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const phase = getExamPhase(timers, slideshowPhaseStartMinutes, slideshowPhaseEndMinutes);
    const phaseSlides = getSlidesForPhase(slideshowMedia, phase);
    const slides = isManuallyShown ? slideshowMedia : phaseSlides;
    const shouldShow = (slideshowEnabled || isManuallyShown) && slides.length > 0 && !isDismissed;

    const safeIndex = slides.length > 0 ? currentIndex % slides.length : 0;
    const currentSlide = slides[safeIndex] ?? null;

    // Load current + prefetch next
    const mediaSrc = useMediaSrc(shouldShow ? currentSlide : null);
    const nextSlide = slides.length > 1 ? slides[(safeIndex + 1) % slides.length] : null;
    useMediaSrc(nextSlide); // background prefetch

    // Fade in once src is ready
    useEffect(() => {
        if (mediaSrc && shouldShow) {
            const t = setTimeout(() => setVisible(true), 50);
            return () => clearTimeout(t);
        } else {
            setVisible(false);
        }
    }, [mediaSrc, shouldShow]);

    // Fade out on slide change, then advance
    const advanceTo = useCallback((fn: (prev: number) => number) => {
        setVisible(false);
        setTimeout(() => {
            setCurrentIndex(fn);
        }, 400);
    }, []);

    // Helper: start (or restart) the auto-advance interval from scratch
    const startInterval = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (slides.length <= 1) return;
        intervalRef.current = setInterval(() => {
            advanceTo(prev => (prev + 1) % slides.length);
        }, slideshowSlideDuration * 1000);
    }, [slides.length, slideshowSlideDuration, advanceTo]);

    // Auto-advance effect — only runs when isAutoPlaying is true
    useEffect(() => {
        if (!shouldShow || !isAutoPlaying) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }
        startInterval();
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [shouldShow, isAutoPlaying, startInterval]);

    // Reset dismiss & resume auto-play when manually triggered
    useEffect(() => {
        if (isManuallyShown) {
            setIsDismissed(false);
            setIsAutoPlaying(true);
        }
    }, [isManuallyShown]);

    const handleDismiss = useCallback(() => {
        setVisible(false);
        setTimeout(() => setIsDismissed(true), 400);
        if (isManuallyShown) onManualDismiss();
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = setTimeout(() => setIsDismissed(false), 2 * 60 * 1000);
    }, [isManuallyShown, onManualDismiss]);

    // Manual nav resets the interval so it doesn't fire immediately after a click
    const goNext = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        advanceTo(prev => (prev + 1) % slides.length);
        if (isAutoPlaying) startInterval();
    }, [slides.length, advanceTo, isAutoPlaying, startInterval]);

    const goPrev = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        advanceTo(prev => (prev - 1 + slides.length) % slides.length);
        if (isAutoPlaying) startInterval();
    }, [slides.length, advanceTo, isAutoPlaying, startInterval]);

    const toggleAutoPlay = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsAutoPlaying(prev => !prev);
    }, []);

    if (!shouldShow || !currentSlide) return null;

    const backdropAlpha = slideshowOpacity / 100;

    return (
        <div
            className={`absolute inset-0 z-40 transition-opacity duration-500 ease-in-out ${visible ? 'opacity-100' : 'opacity-0'}`}
            onClick={handleDismiss}
        >
            {/* ── Blurred backdrop ── */}
            <div
                className="absolute inset-0 backdrop-blur-2xl"
                style={{ backgroundColor: `rgba(0, 0, 0, ${backdropAlpha})` }}
            />

            {/* ── Centred image / video ── */}
            <div className="absolute inset-0 flex items-center justify-center p-10 pointer-events-none">
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
                {/* Top bar: auto-play toggle + dismiss */}
                <div className="flex justify-between items-center p-4 pointer-events-auto">
                    {/* Auto-play toggle */}
                    <button
                        onClick={toggleAutoPlay}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm transition-all border shadow-lg ${isAutoPlaying
                            ? 'bg-white/25 hover:bg-white/35 text-white border-white/30'
                            : 'bg-black/40 hover:bg-black/50 text-white/70 border-white/15'
                            }`}
                        title={isAutoPlaying ? 'Pause auto-advance' : 'Resume auto-advance'}
                    >
                        {isAutoPlaying
                            ? <><Pause size={12} className="shrink-0" /> Auto</>
                            : <><Play size={12} className="shrink-0" /> Paused</>
                        }
                    </button>

                    {/* Dismiss */}
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
                        className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2.5 backdrop-blur-sm transition-all shadow-lg border border-white/20"
                        title="Dismiss slideshow"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Navigation: dots + prev/next arrows */}
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
                                        advanceTo(() => i);
                                        if (isAutoPlaying) startInterval();
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
                {!isAutoPlaying && <span className="ml-1 text-amber-400/60">· Paused</span>}
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

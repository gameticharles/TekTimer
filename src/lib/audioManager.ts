import { convertFileSrc } from '@tauri-apps/api/core';

const audioInstances = new Map<string, HTMLAudioElement>();

// Resolve the bell.mp3 bundled asset URL
const bellUrl = new URL('../assets/bell.mp3', import.meta.url).href;

export const audioManager = {
    play(timerId: string, customPath: string | null, volume: number): void {
        if (audioInstances.has(timerId)) return;
        const src = customPath
            ? convertFileSrc(customPath)
            : bellUrl;
        const audio = new Audio(src);
        audio.loop = true;
        audio.volume = volume;
        audio.play().catch((err) => {
            console.error('Audio play failed:', err);
            // Fallback to bell.mp3 if custom file fails
            if (customPath) {
                const fallback = new Audio(bellUrl);
                fallback.loop = true;
                fallback.volume = volume;
                fallback.play().catch(console.error);
                audioInstances.set(timerId, fallback);
            }
        });
        audioInstances.set(timerId, audio);
    },

    stop(timerId: string): void {
        const audio = audioInstances.get(timerId);
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
        audioInstances.delete(timerId);
    },

    stopAll(): void {
        audioInstances.forEach((a) => {
            a.pause();
            a.currentTime = 0;
        });
        audioInstances.clear();
    },

    playBeep(remainingSeconds: number, volume: number): void {
        // Standard Web Audio API for synthetic beeps
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;

        const ctx = new AudioContextClass();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.value = 800; // 800Hz beep

        // Map remaining seconds to beep duration
        const durationMap: Record<number, number> = {
            5: 0.15,
            4: 0.2,
            3: 0.4,
            2: 0.6,
            1: 0.8
        };
        const duration = durationMap[remainingSeconds];
        if (!duration) return;

        gainNode.gain.setValueAtTime(volume, ctx.currentTime);
        // Fade out slightly to avoid clicking
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);

        // Clean up context after beep
        setTimeout(() => {
            if (ctx.state !== 'closed') {
                ctx.close().catch(console.error);
            }
        }, duration * 1000 + 100);
    },
};

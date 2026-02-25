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
};

import { readFile } from '@tauri-apps/plugin-fs';

const audioInstances = new Map<string, HTMLAudioElement>();

// Resolve the bell.mp3 bundled asset URL
const bellUrl = new URL('../assets/bell.mp3', import.meta.url).href;

export const audioManager = {
    async play(timerId: string, customPath: string | null, volume: number): Promise<void> {
        if (audioInstances.has(timerId)) return;

        let src = bellUrl;
        let blobUrl: string | null = null;

        if (customPath) {
            try {
                // Bypass Tauri's asset:// restrictions by loading bytes directly
                const audioData = await readFile(customPath);
                let mimeType = 'audio/mpeg';
                const lower = customPath.toLowerCase();
                if (lower.endsWith('.wav')) mimeType = 'audio/wav';
                else if (lower.endsWith('.ogg')) mimeType = 'audio/ogg';

                const blob = new Blob([audioData], { type: mimeType });
                blobUrl = URL.createObjectURL(blob);
                src = blobUrl;
            } catch (err) {
                console.error('Failed to read custom audio file directly:', err);
            }
        }

        const audio = new Audio(src);
        audio.loop = true;
        audio.volume = volume;

        if (blobUrl) {
            (audio as any)._blobUrl = blobUrl;
        }

        audio.play().then(() => {
            audioInstances.set(timerId, audio);
        }).catch((err) => {
            console.error('Audio play failed for path:', src, 'with error:', err);

            // If the audio file (custom or default) fails (e.g. strict autoplay or asset missing),
            // play a continuous repeating synthetic alarm using our context.
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;

            const ctx = new AudioContextClass();

            // Create an interval to beep endlessly like an alarm clock until stopped
            const playSynthAlarm = () => {
                if (ctx.state === 'closed') return;

                const oscillator = ctx.createOscillator();
                const gainNode = ctx.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(ctx.destination);

                oscillator.type = 'square'; // harsher sound for main alarm
                oscillator.frequency.value = 880; // A5 note

                gainNode.gain.setValueAtTime(volume, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.3);
            };

            playSynthAlarm(); // play immediately
            const intervalId = setInterval(playSynthAlarm, 600); // repeat every 600ms

            // Store a mock "audio" element so stop() can clear the interval
            const mockAudio = {
                pause: () => {
                    clearInterval(intervalId);
                    if (ctx.state !== 'closed') ctx.close().catch(console.error);
                },
                currentTime: 0
            } as unknown as HTMLAudioElement;

            audioInstances.set(timerId, mockAudio);
        });
    },

    stop(timerId: string): void {
        const audio = audioInstances.get(timerId);
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;

        if ((audio as any)._blobUrl) {
            URL.revokeObjectURL((audio as any)._blobUrl);
        }

        audioInstances.delete(timerId);
    },

    stopAll(): void {
        audioInstances.forEach((a) => {
            a.pause();
            a.currentTime = 0;
            if ((a as any)._blobUrl) {
                URL.revokeObjectURL((a as any)._blobUrl);
            }
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

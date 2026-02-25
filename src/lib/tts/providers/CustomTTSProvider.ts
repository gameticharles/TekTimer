import type { TTSProvider, TTSSpeakOptions } from '../types';
import type { AppSettings } from '../../types';

export class CustomTTSProvider implements TTSProvider {
    readonly name = 'Custom API (e.g. KittenTTS)';
    private settings: AppSettings;
    private currentAudio: HTMLAudioElement | null = null;

    constructor(settings: AppSettings) {
        this.settings = settings;
    }

    isAvailable(): boolean {
        return !!this.settings.customTTSUrl;
    }

    async speak(text: string, options?: TTSSpeakOptions): Promise<void> {
        this.stop();

        if (!this.settings.customTTSUrl) {
            console.warn('Custom TTS URL is missing');
            return;
        }

        try {
            // We default to a standard GET endpoint that returns audio, or we can use POST if appropriate.
            // A simple approach is passing text in query logic or body.
            // Let's assume a generic POST endpoint that takes JSON { text, voice } and returns an audio blob.
            const response = await fetch(this.settings.customTTSUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text,
                    voice: options?.voiceId || this.settings.customTTSVoice || 'Jasper'
                })
            });

            if (!response.ok) {
                throw new Error(`Custom TTS API Failed: ${response.status} ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const blob = new Blob([arrayBuffer], { type: 'audio/wav' }); // Assume wav output
            const blobUrl = URL.createObjectURL(blob);

            const audio = new Audio(blobUrl);
            audio.playbackRate = options?.rate ?? 0.9;
            audio.volume = options?.volume ?? 1.0;

            this.currentAudio = audio;

            await new Promise<void>((resolve, reject) => {
                audio.oncanplaythrough = () => {
                    audio.play().catch(reject);
                    resolve();
                };
                audio.onerror = reject;
                audio.onended = () => {
                    URL.revokeObjectURL(blobUrl);
                    options?.onEnded?.();
                };
            });

        } catch (err) {
            console.error('CustomTTSProvider failed:', err);
            options?.onEnded?.(); // Proceed to next anyway
        }
    }

    stop(): void {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
    }
}

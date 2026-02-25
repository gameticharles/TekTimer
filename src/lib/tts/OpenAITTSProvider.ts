import { TTSProvider, TTSSpeakOptions } from './types';

export class OpenAITTSProvider implements TTSProvider {
    readonly name = 'OpenAI TTS';
    private apiKey: string;
    private model: 'tts-1' | 'tts-1-hd';
    private currentAudio: HTMLAudioElement | null = null;

    constructor(apiKey: string, model: 'tts-1' | 'tts-1-hd' = 'tts-1') {
        this.apiKey = apiKey;
        this.model = model;
    }

    async speak(text: string, options?: TTSSpeakOptions): Promise<void> {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.model,
                input: text,
                voice: options?.voiceId ?? 'nova',  // alloy, echo, fable, onyx, nova, shimmer
                speed: options?.rate ?? 0.95,
            }),
        });

        if (!response.ok) throw new Error(`OpenAI TTS error: ${response.statusText}`);

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        this.currentAudio = new Audio(url);
        this.currentAudio.volume = options?.volume ?? 1.0;

        // Create a promise that resolves when playback actually starts,
        // not just when the fetch completes.
        return new Promise((resolve, reject) => {
            if (!this.currentAudio) return reject(new Error('Audio cancelled'));
            this.currentAudio.onplay = () => resolve();
            this.currentAudio.onerror = reject;
            if (options?.onEnded) {
                this.currentAudio.onended = () => {
                    options.onEnded!();
                };
            }
            this.currentAudio.play().catch(reject);
        });
    }

    stop(): void {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
    }

    isAvailable(): boolean {
        return !!this.apiKey && navigator.onLine;
    }
}

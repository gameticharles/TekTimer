import { TTSProvider, TTSSpeakOptions } from './types';

export class ElevenLabsTTSProvider implements TTSProvider {
    readonly name = 'ElevenLabs';
    private apiKey: string;
    private voiceId: string;
    private currentAudio: HTMLAudioElement | null = null;

    constructor(apiKey: string, voiceId = '21m00Tcm4TlvDq8ikWAM') { // Default: Rachel
        this.apiKey = apiKey;
        this.voiceId = voiceId;
    }

    async speak(text: string, options?: TTSSpeakOptions): Promise<void> {
        const voiceId = options?.voiceId ?? this.voiceId;
        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    model_id: 'eleven_turbo_v2',
                    voice_settings: {
                        stability: 0.6,
                        similarity_boost: 0.8,
                        speed: options?.rate ?? 0.95,
                    },
                }),
            }
        );

        if (!response.ok) throw new Error(`ElevenLabs error: ${response.statusText}`);

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        this.currentAudio = new Audio(url);
        this.currentAudio.volume = options?.volume ?? 1.0;

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

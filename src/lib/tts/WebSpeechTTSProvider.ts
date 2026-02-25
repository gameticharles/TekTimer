import { TTSProvider, TTSSpeakOptions } from './types';

export class WebSpeechTTSProvider implements TTSProvider {
    readonly name = 'System Voice (Built-in)';

    speak(text: string, options?: TTSSpeakOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.isAvailable()) return reject(new Error('Speech synthesis not available'));

            window.speechSynthesis.cancel(); // Clear any queued speech

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = options?.rate ?? 0.9;
            utterance.pitch = options?.pitch ?? 1.0;
            utterance.volume = options?.volume ?? 1.0;

            if (options?.voiceId) {
                const voices = window.speechSynthesis.getVoices();
                const match = voices.find(v => v.voiceURI === options.voiceId);
                if (match) utterance.voice = match;
            }

            utterance.onstart = () => resolve();
            utterance.onerror = (e) => reject(e);

            window.speechSynthesis.speak(utterance);
        });
    }

    stop(): void {
        if (this.isAvailable()) {
            window.speechSynthesis.cancel();
        }
    }

    isAvailable(): boolean {
        return typeof window !== 'undefined' && 'speechSynthesis' in window;
    }

    /** Returns all available system voices for the Settings voice picker. */
    static getVoices(): SpeechSynthesisVoice[] {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
        return window.speechSynthesis.getVoices();
    }
}

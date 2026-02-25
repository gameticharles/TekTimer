import { getTTSProvider } from '../tts/getTTSProvider';
import { TTSProvider } from '../tts/types';
import { WebSpeechTTSProvider } from '../tts/WebSpeechTTSProvider';
import type { AppSettings } from '../types';

interface QueuedAnnouncement {
    id: string;              // Announcement entry ID (for deduplication)
    text: string;            // Resolved text (variables already substituted)
    priority: number;        // Lower = higher priority. 0 = manual, 1 = end-of-exam, 2 = milestone
}

class AnnouncementQueue {
    private queue: QueuedAnnouncement[] = [];
    private isSpeaking = false;
    private currentText: string | null = null;
    private settings: AppSettings | null = null;

    setSettings(settings: AppSettings) {
        this.settings = settings;
    }

    enqueue(announcement: QueuedAnnouncement): void {
        // Deduplicate logic
        if (this.queue.some(a => a.id === announcement.id)) return;

        // Insert sorted by priority (lower number = front of queue)
        const idx = this.queue.findIndex(a => a.priority > announcement.priority);
        if (idx === -1) {
            this.queue.push(announcement);
        } else {
            this.queue.splice(idx, 0, announcement);
        }

        if (!this.isSpeaking) {
            this.processNext();
        }
    }

    private async processNext(): Promise<void> {
        if (this.queue.length === 0 || !this.settings) {
            this.isSpeaking = false;
            this.currentText = null;
            return;
        }

        this.isSpeaking = true;
        const next = this.queue.shift()!;
        this.currentText = next.text;

        try {
            const provider = getTTSProvider(this.settings);
            await new Promise<void>((resolve) => {
                speakAndAwaitEnd(provider, next.text, this.settings!, resolve);
            });
        } catch (err) {
            console.error('Announcement failed:', err);
        }

        // Delay between announcements
        await sleep(800);
        this.processNext();
    }

    skip(): void {
        if (this.settings) {
            getTTSProvider(this.settings).stop();
        }
    }

    clear(): void {
        this.queue = [];
        if (this.settings) {
            getTTSProvider(this.settings).stop();
        }
        this.isSpeaking = false;
        this.currentText = null;
    }

    get pendingCount(): number {
        return this.queue.length;
    }

    get isActive(): boolean {
        return this.isSpeaking || this.queue.length > 0;
    }

    get currentAnnouncementText(): string | null {
        return this.isSpeaking ? this.currentText : null;
    }
}

export const announcementQueue = new AnnouncementQueue();

async function speakAndAwaitEnd(
    provider: TTSProvider,
    text: string,
    settings: AppSettings,
    onEnd: () => void
): Promise<void> {
    if (provider instanceof WebSpeechTTSProvider) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = settings.ttsRate;
        utterance.volume = settings.ttsVolume;
        if (settings.ttsVoiceId) {
            const voices = window.speechSynthesis.getVoices();
            const match = voices.find(v => v.voiceURI === settings.ttsVoiceId);
            if (match) utterance.voice = match;
        }
        utterance.onend = onEnd;
        utterance.onerror = onEnd;
        window.speechSynthesis.speak(utterance);
    } else {
        // Audio-based providers (OpenAI/ElevenLabs)
        try {
            await provider.speak(text, {
                rate: settings.ttsRate,
                volume: settings.ttsVolume,
                voiceId: settings.ttsVoiceId || undefined,
                onEnded: onEnd
            });
        } catch (e) {
            console.error("Audio provider error", e);
            onEnd();
        }
    }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

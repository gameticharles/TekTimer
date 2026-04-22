import { getTTSProvider } from '../tts/getTTSProvider';
import { TTSProvider } from '../tts/types';
import { WebSpeechTTSProvider } from '../tts/WebSpeechTTSProvider';
import { KokoroTTSProvider } from '../tts/KokoroTTSProvider';
import type { AppSettings } from '../types';

interface QueuedAnnouncement {
    id: string;              // Announcement entry ID (for deduplication)
    text: string;            // Resolved text (variables already substituted)
    priority: number;        // Lower = higher priority. 0 = manual, 1 = end-of-exam, 2 = milestone
    voiceIdOverride?: string; // Optional specific voice to use just for this announcement
}

/** Text-based dedup: prevents the same phrase from being spoken twice within
 *  a short window. Solves the "multiple timers in a group all fire the same
 *  announcement" problem — only the first one wins. */
const _recentlySpoken = new Map<string, number>(); // text → epoch ms
const TEXT_DEDUP_WINDOW_MS = 8_000; // 8 seconds

class AnnouncementQueue {
    private queue: QueuedAnnouncement[] = [];
    private isSpeaking = false;
    private currentText: string | null = null;
    private settings: AppSettings | null = null;

    setSettings(settings: AppSettings) {
        this.settings = settings;
    }

    enqueue(announcement: QueuedAnnouncement): void {
        // 1. ID-based dedup (same timer+entry already queued)
        if (this.queue.some(a => a.id === announcement.id)) return;

        // 2. Text+time dedup (same phrase already spoken/queued recently)
        //    Handles multiple timers in a group firing the identical text.
        const now = Date.now();
        const lastSpoken = _recentlySpoken.get(announcement.text);
        if (lastSpoken && now - lastSpoken < TEXT_DEDUP_WINDOW_MS) return;
        _recentlySpoken.set(announcement.text, now);

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

    /**
     * Pre-warm Kokoro by generating (but not playing) the audio for the next
     * queued announcement. Call this ~10s before the trigger fires so generation
     * latency is hidden.
     */
    preWarm(text: string): void {
        if (!this.settings || this.settings.ttsProvider !== 'kokoro') return;
        const provider = getTTSProvider(this.settings);
        if (provider instanceof KokoroTTSProvider) {
            provider.preGenerate(text);
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

        const repeatCount = Math.max(1, this.settings.announcementRepeatCount ?? 1);

        try {
            const provider = getTTSProvider(this.settings);
            for (let i = 0; i < repeatCount; i++) {
                await new Promise<void>((resolve) => {
                    speakAndAwaitEnd(provider, next.text, this.settings!, resolve, next.voiceIdOverride);
                });
                // Brief pause between repetitions (not after the last one)
                if (i < repeatCount - 1) {
                    await sleep(1500);
                }
            }
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
    onEnd: () => void,
    voiceIdOverride?: string
): Promise<void> {
    if (provider instanceof WebSpeechTTSProvider) {
        // Web Speech API: drive directly so onend fires correctly
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = settings.ttsRate;
        utterance.volume = settings.ttsVolume;
        
        const effectiveVoiceId = voiceIdOverride || settings.ttsVoiceId;
        if (effectiveVoiceId) {
            const voices = window.speechSynthesis.getVoices();
            const match = voices.find(v => v.voiceURI === effectiveVoiceId);
            if (match) utterance.voice = match;
        }
        utterance.onend = onEnd;
        utterance.onerror = onEnd;
        window.speechSynthesis.speak(utterance);
    } else if (provider instanceof KokoroTTSProvider) {
        // Kokoro: pass the correct voice ID and wait for onEnded callback
        try {
            await provider.speak(text, {
                rate: settings.ttsRate,
                volume: settings.ttsVolume,
                voiceId: voiceIdOverride || settings.kokoroVoiceId || undefined,
                onEnded: onEnd,
            });
        } catch (e) {
            console.error('Kokoro TTS error:', e);
            onEnd();
        }
    } else {
        // Custom API / OpenAI / ElevenLabs
        try {
            await provider.speak(text, {
                rate: settings.ttsRate,
                volume: settings.ttsVolume,
                voiceId: voiceIdOverride || settings.ttsVoiceId || undefined,
                onEnded: onEnd,
            });
        } catch (e) {
            console.error('Audio provider error:', e);
            onEnd();
        }
    }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

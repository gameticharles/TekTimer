/**
 * KokoroTTSProvider
 *
 * Runs Kokoro-82M ONNX inference on a background Web Worker so the UI
 * thread is never blocked. Generated audio is cached in an LRU map so
 * repeated announcements (e.g., "You have 1 hour remaining") play
 * instantly without re-generating.
 */
import type { TTSProvider, TTSSpeakOptions } from './types';

// ── Voice catalogue ────────────────────────────────────────────────────────────

export interface KokoroVoice {
    id: string;
    label: string;
    lang: 'en-US' | 'en-GB' | 'ja' | 'zh';
    gender: 'female' | 'male';
}

export const KOKORO_VOICES: KokoroVoice[] = [
    // American English — female
    { id: 'af_bella', label: 'Bella (US Female)', lang: 'en-US', gender: 'female' },
    { id: 'af_sky', label: 'Sky (US Female)', lang: 'en-US', gender: 'female' },
    { id: 'af_nicole', label: 'Nicole (US Female)', lang: 'en-US', gender: 'female' },
    { id: 'af_sarah', label: 'Sarah (US Female)', lang: 'en-US', gender: 'female' },
    { id: 'af_jessica', label: 'Jessica (US Female)', lang: 'en-US', gender: 'female' },
    { id: 'af_nova', label: 'Nova (US Female)', lang: 'en-US', gender: 'female' },
    { id: 'af_heart', label: 'Heart (US Female)', lang: 'en-US', gender: 'female' },
    // American English — male
    { id: 'am_adam', label: 'Adam (US Male)', lang: 'en-US', gender: 'male' },
    { id: 'am_michael', label: 'Michael (US Male)', lang: 'en-US', gender: 'male' },
    { id: 'am_echo', label: 'Echo (US Male)', lang: 'en-US', gender: 'male' },
    { id: 'am_liam', label: 'Liam (US Male)', lang: 'en-US', gender: 'male' },
    { id: 'am_eric', label: 'Eric (US Male)', lang: 'en-US', gender: 'male' },
    // British English — female
    { id: 'bf_emma', label: 'Emma (UK Female)', lang: 'en-GB', gender: 'female' },
    { id: 'bf_alice', label: 'Alice (UK Female)', lang: 'en-GB', gender: 'female' },
    // British English — male
    { id: 'bm_george', label: 'George (UK Male)', lang: 'en-GB', gender: 'male' },
    { id: 'bm_lewis', label: 'Lewis (UK Male)', lang: 'en-GB', gender: 'male' },
    { id: 'bm_daniel', label: 'Daniel (UK Male)', lang: 'en-GB', gender: 'male' },
];

export const DEFAULT_KOKORO_VOICE = 'am_michael';

// ── Audio output type ──────────────────────────────────────────────────────────

type KokoroAudioOutput = {
    audio: Float32Array;
    sampling_rate: number;
};

// ── Persistent LRU audio cache ─────────────────────────────────────────────────

const CACHE_MAX = 30; // maximum number of distinct text+voice entries to keep
/** Keyed by `${voice}::${text}`. Retained across calls — NOT deleted after use. */
const _audioCache = new Map<string, KokoroAudioOutput>();

function cacheSet(key: string, output: KokoroAudioOutput) {
    if (_audioCache.size >= CACHE_MAX) {
        // Evict the oldest entry (insertion order)
        _audioCache.delete(_audioCache.keys().next().value!);
    }
    _audioCache.set(key, output);
}

// ── Worker management ──────────────────────────────────────────────────────────

let _worker: Worker | null = null;
let _workerLoaded = false;
let _workerLoadResolvers: Array<() => void> = [];

/** Pending generation promises, keyed by cache key */
const _inFlight = new Map<string, Promise<KokoroAudioOutput>>();

function getWorker(): Worker {
    if (_worker) return _worker;

    _worker = new Worker(
        new URL('./kokoro.worker.ts', import.meta.url),
        { type: 'module' }
    );

    _worker.addEventListener('message', (event: MessageEvent) => {
        const msg = event.data as {
            type: 'loaded' | 'result' | 'error';
            id?: string;
            audio?: Float32Array;
            sampling_rate?: number;
            error?: string;
        };

        if (msg.type === 'loaded') {
            _workerLoaded = true;
            const resolvers = _workerLoadResolvers;
            _workerLoadResolvers = [];
            resolvers.forEach(r => r());
            return;
        }

        if (msg.type === 'result' && msg.id) {
            const output: KokoroAudioOutput = {
                audio: new Float32Array(msg.audio!),
                sampling_rate: msg.sampling_rate!,
            };
            // Store in persistent cache
            cacheSet(msg.id, output);
            // The _inFlight promise map resolves via a separate handler set up in generate()
        }

        if (msg.type === 'error') {
            console.warn('[KokoroTTS] Worker error:', msg.error);
        }
    });

    return _worker;
}

/**
 * Ensure the worker model is loaded.
 */
function ensureWorkerLoaded(): Promise<void> {
    if (_workerLoaded) return Promise.resolve();
    return new Promise(resolve => {
        _workerLoadResolvers.push(resolve);
        getWorker().postMessage({ type: 'warmup', id: 'warmup' });
    });
}

/**
 * Generate audio via the Web Worker.
 * Returns from LRU cache if previously generated—zero additional wait.
 * If a generation for the same key is already in-flight, awaits the same promise.
 */
function generate(
    text: string,
    voice: string,
    speed: number
): Promise<KokoroAudioOutput> {
    const cacheKey = `${voice}::${text}`;

    // 1. LRU cache hit — instant
    const cached = _audioCache.get(cacheKey);
    if (cached) {
        // Promote to MRU position
        _audioCache.delete(cacheKey);
        _audioCache.set(cacheKey, cached);
        return Promise.resolve(cached);
    }

    // 2. In-flight — return same promise to avoid duplicate generation
    const inflight = _inFlight.get(cacheKey);
    if (inflight) return inflight;

    // 3. Start new generation in worker
    const promise = new Promise<KokoroAudioOutput>((resolve, reject) => {
        const worker = getWorker();

        const handler = (event: MessageEvent) => {
            const msg = event.data as {
                type: 'result' | 'error';
                id?: string;
                audio?: Float32Array;
                sampling_rate?: number;
                error?: string;
            };
            if (msg.id !== cacheKey) return; // not for us
            worker.removeEventListener('message', handler);
            _inFlight.delete(cacheKey);

            if (msg.type === 'result') {
                resolve({ audio: new Float32Array(msg.audio!), sampling_rate: msg.sampling_rate! });
            } else {
                reject(new Error(msg.error));
            }
        };

        worker.addEventListener('message', handler);
        worker.postMessage({ type: 'generate', id: cacheKey, text, voice, speed });
    });

    _inFlight.set(cacheKey, promise);
    return promise;
}

// ── AudioContext playback ──────────────────────────────────────────────────────

let _currentSource: AudioBufferSourceNode | null = null;
let _audioCtx: AudioContext | null = null;

function playAudioBuffer(
    output: KokoroAudioOutput,
    volume: number,
    onEnded?: () => void
): void {
    if (!_audioCtx || _audioCtx.state === 'closed') {
        _audioCtx = new AudioContext();
    }

    const buffer = _audioCtx.createBuffer(1, output.audio.length, output.sampling_rate);
    buffer.copyToChannel(output.audio, 0);

    const source = _audioCtx.createBufferSource();
    source.buffer = buffer;

    const gain = _audioCtx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));

    source.connect(gain);
    gain.connect(_audioCtx.destination);

    source.onended = () => {
        _currentSource = null;
        onEnded?.();
    };

    _currentSource = source;
    source.start();
}

// ── Provider class ─────────────────────────────────────────────────────────────

export class KokoroTTSProvider implements TTSProvider {
    readonly name = 'Kokoro AI Voice (Local)';

    private voiceId: string;

    constructor(voiceId?: string | null) {
        this.voiceId = voiceId || DEFAULT_KOKORO_VOICE;
    }

    async speak(text: string, options?: TTSSpeakOptions): Promise<void> {
        this.stop();

        const voice = options?.voiceId || this.voiceId;
        const speed = options?.rate ?? 1.0;
        const volume = options?.volume ?? 1.0;

        // generate() checks LRU cache first — instant if cached, otherwise
        // awaits the background worker (non-blocking for the UI).
        const output = await generate(text, voice, speed);
        playAudioBuffer(output, volume, options?.onEnded);
    }

    stop(): void {
        if (_currentSource) {
            try { _currentSource.stop(); } catch { /* already stopped */ }
            _currentSource = null;
        }
    }

    /**
     * Pre-generate audio N seconds before playback so speak() is instant.
     * Safe to call multiple times — deduplicates via _inFlight.
     */
    preGenerate(text: string): void {
        const voice = this.voiceId;
        generate(text, voice, 1.0).catch(err =>
            console.warn('[KokoroTTS] Pre-generation failed (non-fatal):', err)
        );
    }

    isAvailable(): boolean {
        return true;
    }

    /** Pre-warm: loads the worker and model in the background. */
    static warmUp(): void {
        ensureWorkerLoaded().catch(err =>
            console.warn('[KokoroTTS] Warm-up failed (non-fatal):', err)
        );
    }

    static get isLoaded(): boolean {
        return _workerLoaded;
    }
}

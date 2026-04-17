/**
 * Kokoro TTS Web Worker
 * Loads and runs the ONNX model on a background thread so the main UI
 * never freezes during model loading or audio generation.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tts: any = null;

async function ensureModel() {
    if (tts) return tts;
    // Dynamic import inside worker
    const { KokoroTTS } = await import('kokoro-js');
    tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-ONNX', {
        dtype: 'q8',
    });
    console.info('[KokoroWorker] Model loaded.');
    return tts;
}

self.addEventListener('message', async (event: MessageEvent) => {
    const { type, id, text, voice, speed } = event.data as {
        type: 'warmup' | 'generate';
        id: string;
        text?: string;
        voice?: string;
        speed?: number;
    };

    if (type === 'warmup') {
        try {
            await ensureModel();
            self.postMessage({ type: 'loaded' });
        } catch (err) {
            self.postMessage({ type: 'error', id: 'warmup', error: String(err) });
        }
        return;
    }

    if (type === 'generate') {
        try {
            const model = await ensureModel();
            const output = await model.generate(text!, { voice: voice!, speed: speed ?? 1.0 });
            // Copy Float32Array so we don't transfer (main thread caches it)
            const audioCopy: Float32Array =
                output.audio instanceof Float32Array
                    ? output.audio.slice()
                    : new Float32Array(output.audio);
            self.postMessage({
                type: 'result',
                id,
                audio: audioCopy,
                sampling_rate: output.sampling_rate,
            });
        } catch (err) {
            self.postMessage({ type: 'error', id, error: String(err) });
        }
    }
});

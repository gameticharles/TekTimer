export interface TTSProvider {
    /**
     * Speak the given text. Returns a Promise that resolves when
     * speech has started (not when it has finished).
     */
    speak(text: string, options?: TTSSpeakOptions): Promise<void>;

    /** Immediately stop any current speech. */
    stop(): void;

    /** Returns true if this provider is available and configured. */
    isAvailable(): boolean;

    /** Human-readable name shown in Settings. */
    readonly name: string;
}

export interface TTSSpeakOptions {
    rate?: number;    // 0.5–2.0, default 0.9 (slightly slower for clarity)
    pitch?: number;   // 0.0–2.0, default 1.0
    volume?: number;  // 0.0–1.0, default 1.0
    voiceId?: string; // Provider-specific voice identifier
    onEnded?: () => void;
}

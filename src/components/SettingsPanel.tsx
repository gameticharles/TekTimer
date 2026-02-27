import { useState, useEffect } from 'react';
import {
    X, RotateCcw, Volume2, VolumeX, Play, Upload, Loader2
} from 'lucide-react';
import { getTTSProvider } from '../lib/tts/getTTSProvider';
import type { AppSettings } from '../lib/types';
import { SCALE_STEP, SCALE_MIN, SCALE_MAX } from '../lib/fontSizeUtils';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { appDataDir, join } from '@tauri-apps/api/path';
import { exists, mkdir } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { audioManager } from '../lib/audioManager';

interface SettingsPanelProps {
    settings: AppSettings;
    onUpdate: (patch: Partial<AppSettings>) => void;
    onReset: () => void;
    onClose: () => void;
}

function WebSpeechVoiceSelector({ settings, onUpdate }: { settings: AppSettings, onUpdate: (p: Partial<AppSettings>) => void }) {
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    useEffect(() => {
        const updateVoices = () => setVoices(window.speechSynthesis.getVoices());
        updateVoices();
        window.speechSynthesis.onvoiceschanged = updateVoices;
    }, []);

    return (
        <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Voice</label>
            <select
                value={settings.ttsVoiceId || ''}
                onChange={(e) => onUpdate({ ttsVoiceId: e.target.value })}
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-transparent rounded-lg text-sm
          text-gray-900 dark:text-white focus:border-emerald-500 focus:bg-white dark:focus:bg-gray-900 transition-colors"
                disabled={voices.length === 0}
            >
                <option value="">Default System Voice</option>
                {voices.map(v => (
                    <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                ))}
            </select>
        </div>
    );
}


export default function SettingsPanel({ settings, onUpdate, onReset, onClose }: SettingsPanelProps) {
    const [testPlaying, setTestPlaying] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const handleSelectAlarm = async () => {
        try {
            const selectedPath = await openDialog({
                multiple: false,
                filters: [{ name: 'Audio File', extensions: ['mp3', 'wav', 'ogg'] }]
            }) as string | null;

            if (!selectedPath) return;

            setIsUploading(true);

            // Ensure app data dir exists for storing custom audio
            const dataDir = await appDataDir();
            const alarmsDir = await join(dataDir, 'alarms');
            if (!(await exists(alarmsDir))) {
                await mkdir(alarmsDir, { recursive: true });
            }

            // Copy file to AppData by delegating to Rust backend to bypass scope limits
            // Extract the original filename
            const originalFilename = selectedPath.split(/[/\\]/).pop() || 'custom_alarm.mp3';
            // We append the timestamp to avoid collisions, but keep the original name visible
            const sanitizedName = originalFilename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const targetPath = await join(alarmsDir, `${Date.now()}_${sanitizedName}`);

            await invoke('copy_alarm_file', { sourcePath: selectedPath, targetPath });

            onUpdate({ customAlarmPath: targetPath });
        } catch (error) {
            console.error("Failed to select custom alarm:", error);
            alert("Error saving custom alarm: " + String(error));
        } finally {
            setIsUploading(false);
        }
    };

    const handleTestAlarm = () => {
        if (testPlaying) {
            audioManager.stop('test-alarm');
            setTestPlaying(false);
        } else {
            audioManager.play('test-alarm', settings.customAlarmPath, settings.alarmVolume);
            setTestPlaying(true);
            setTimeout(() => {
                audioManager.stop('test-alarm');
                setTestPlaying(false);
            }, 3000);
        }
    };

    // Helper to extract a display-friendly filename from the custom path
    const getAlarmDisplayFileName = () => {
        if (!settings.customAlarmPath) return null;
        // The path looks like .../alarms/1234567890_my_song.mp3
        const parts = settings.customAlarmPath.split(/[/\\]/);
        const fileName = parts[parts.length - 1];
        // Strip out the timestamp prefix if it exists
        const timestampMatch = fileName.match(/^\d+_(.+)$/);
        return timestampMatch ? timestampMatch[1] : fileName;
    };

    return (
        <div className="fixed inset-0 z-40 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-gray-900/20 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="relative w-[420px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 h-full overflow-y-auto shadow-2xl transition-colors">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10 transition-colors">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        ⚙ Settings
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {/* ─── DISPLAY ────────────────────────────────────── */}
                    <section>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Display</h3>

                        {/* Global Font Size */}
                        <div className="mb-4">
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Global Font Size</label>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => onUpdate({ globalFontScale: Math.max(SCALE_MIN, settings.globalFontScale - SCALE_STEP) })}
                                    disabled={settings.globalFontScale <= SCALE_MIN}
                                    className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 
                             disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-bold"
                                >
                                    A−
                                </button>
                                <span className="text-gray-900 dark:text-white font-mono text-sm min-w-[3rem] text-center">
                                    {settings.globalFontScale}%
                                </span>
                                <button
                                    onClick={() => onUpdate({ globalFontScale: Math.min(SCALE_MAX, settings.globalFontScale + SCALE_STEP) })}
                                    disabled={settings.globalFontScale >= SCALE_MAX}
                                    className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 
                             disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-bold"
                                >
                                    A+
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Affects all timers with no override</p>
                        </div>

                        {/* Show Progress Bar */}
                        <div className="flex flex-col mb-4 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800 transition-colors gap-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show Progress Bar</span>
                                <button
                                    onClick={() => onUpdate({ showProgressBar: !settings.showProgressBar })}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${settings.showProgressBar ? 'bg-emerald-500 dark:bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'
                                        }`}
                                >
                                    <div
                                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${settings.showProgressBar ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                    />
                                </button>
                            </div>

                            {settings.showProgressBar && (
                                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm text-gray-600 dark:text-gray-400">Thickness</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="range"
                                                min={4}
                                                max={32}
                                                step={2}
                                                value={settings.progressBarHeight ?? 20}
                                                onChange={(e) => onUpdate({ progressBarHeight: Number(e.target.value) })}
                                                className="w-24 accent-emerald-500"
                                            />
                                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400 w-8">{settings.progressBarHeight ?? 20}px</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Theme */}
                        <div className="mb-4">
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Theme</label>
                            <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                {(['system', 'light', 'dark'] as const).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => onUpdate({ theme: t })}
                                        className={`flex-1 py-1.5 text-sm rounded-md transition-all font-medium capitalize ${settings.theme === t
                                            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                                            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                            }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Ignore Completed in Center Stage */}
                        <div className="flex items-center justify-between mt-4">
                            <span className="text-sm text-gray-700 dark:text-gray-300">Hide ended timers in Center Stage</span>
                            <button
                                onClick={() => onUpdate({ ignoreCompletedInCenterStage: !settings.ignoreCompletedInCenterStage })}
                                className={`relative w-11 h-6 rounded-full transition-colors ${settings.ignoreCompletedInCenterStage ? 'bg-emerald-500 dark:bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'
                                    }`}
                            >
                                <div
                                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${settings.ignoreCompletedInCenterStage ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                />
                            </button>
                        </div>
                    </section>

                    {/* ─── WARNINGS ───────────────────────────────────── */}
                    <section>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Warnings</h3>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700 dark:text-gray-300">Warning threshold</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={2}
                                        max={60}
                                        value={Math.round(settings.warningThresholdSeconds / 60)}
                                        onChange={(e) => {
                                            const mins = Math.max(2, Number(e.target.value));
                                            if (mins * 60 > settings.criticalThresholdSeconds) {
                                                onUpdate({ warningThresholdSeconds: mins * 60 });
                                            }
                                        }}
                                        className="w-16 px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                               text-gray-900 dark:text-white text-center text-sm focus:outline-none focus:border-amber-500/50"
                                    />
                                    <span className="text-gray-500 dark:text-gray-400 text-xs">min</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700 dark:text-gray-300">Critical threshold</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={1}
                                        max={30}
                                        value={Math.round(settings.criticalThresholdSeconds / 60)}
                                        onChange={(e) => {
                                            const mins = Math.max(1, Number(e.target.value));
                                            if (mins * 60 < settings.warningThresholdSeconds) {
                                                onUpdate({ criticalThresholdSeconds: mins * 60 });
                                            }
                                        }}
                                        className="w-16 px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                               text-gray-900 dark:text-white text-center text-sm focus:outline-none focus:border-amber-500/50"
                                    />
                                    <span className="text-gray-500 dark:text-gray-400 text-xs">min</span>
                                </div>
                            </div>

                            <p className="text-xs text-gray-500">Critical must be less than warning</p>
                        </div>
                    </section>

                    {/* ─── AUDIO ──────────────────────────────────────── */}
                    <section>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Audio</h3>

                        {/* Sound on timer end */}
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                {settings.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                                Sound on timer end
                            </span>
                            <button
                                onClick={() => onUpdate({ soundEnabled: !settings.soundEnabled })}
                                className={`relative w-11 h-6 rounded-full transition-colors ${settings.soundEnabled ? 'bg-emerald-500 dark:bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'
                                    }`}
                            >
                                <div
                                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${settings.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                />
                            </button>
                        </div>

                        {/* Volume */}
                        <div className="mb-4">
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                                Volume — {Math.round(settings.alarmVolume * 100)}%
                            </label>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={Math.round(settings.alarmVolume * 100)}
                                onChange={(e) => onUpdate({ alarmVolume: Number(e.target.value) / 100 })}
                                className="w-full accent-emerald-500 mb-6"
                            />
                        </div>

                        {/* Custom Alarm Source */}
                        <div className="mb-2">
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Alarm Sound File</label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleSelectAlarm}
                                    disabled={isUploading}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition disabled:opacity-50"
                                >
                                    {isUploading ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <Upload size={16} />
                                    )}
                                    <span className="truncate max-w-[140px]">
                                        {isUploading
                                            ? 'Uploading...'
                                            : settings.customAlarmPath
                                                ? getAlarmDisplayFileName()
                                                : 'Upload MP3'}
                                    </span>
                                </button>

                                <button
                                    onClick={handleTestAlarm}
                                    disabled={!settings.soundEnabled || isUploading}
                                    className={`p-2 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors ${testPlaying
                                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                                        : 'bg-gray-100 dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-gray-700 hover:text-emerald-700 dark:hover:text-emerald-300'
                                        } disabled:opacity-50`}
                                    title="Test Alarm Sound"
                                >
                                    <Play size={16} className={testPlaying ? "animate-pulse" : ""} fill={testPlaying ? "currentColor" : "none"} />
                                </button>

                                {settings.customAlarmPath && (
                                    <button
                                        onClick={() => {
                                            if (testPlaying) {
                                                audioManager.stop('test-alarm');
                                                setTestPlaying(false);
                                            }
                                            onUpdate({ customAlarmPath: null });
                                        }}
                                        disabled={isUploading}
                                        className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                                        title="Reset to default system bell"
                                    >
                                        <RotateCcw size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* ─── END STATE ──────────────────────────────────── */}
                    <section>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">End State</h3>
                        <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Message on screen</label>
                            <input
                                type="text"
                                value={settings.endMessage}
                                onChange={(e) => onUpdate({ endMessage: e.target.value.slice(0, 60) })}
                                maxLength={60}
                                className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                           text-gray-900 dark:text-white text-sm focus:outline-none focus:border-amber-500/50"
                            />
                            <p className="text-xs text-gray-500 mt-1">{settings.endMessage.length}/60 characters</p>
                        </div>
                    </section>

                    {/* ─── ANNOUNCEMENTS ──────────────────────────────── */}
                    <section>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Announcements</h3>

                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm text-gray-700 dark:text-gray-300">Enable Announcements</span>
                            <button
                                onClick={() => onUpdate({ announcementsEnabled: !settings.announcementsEnabled })}
                                className={`relative w-11 h-6 rounded-full transition-colors ${settings.announcementsEnabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                            >
                                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${settings.announcementsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {settings.announcementsEnabled && (
                            <div className="space-y-4 pl-2 border-l-2 border-gray-200 dark:border-gray-800">
                                <div>
                                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Voice Provider</label>
                                    <select
                                        value={settings.ttsProvider}
                                        onChange={(e) => onUpdate({ ttsProvider: e.target.value as any })}
                                        className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-amber-500/50"
                                    >
                                        <option value="web-speech">System Voice (Built-in)</option>
                                        <option value="custom-api">Custom API (Local/KittenTTS)</option>
                                    </select>
                                </div>

                                {settings.ttsProvider === 'web-speech' && (
                                    <WebSpeechVoiceSelector settings={settings} onUpdate={onUpdate} />
                                )}
                                {settings.ttsProvider === 'custom-api' && (
                                    <>
                                        <div>
                                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Custom API URL (POST endpoint)</label>
                                            <input
                                                type="text"
                                                value={settings.customTTSUrl || ''}
                                                onChange={(e) => onUpdate({ customTTSUrl: e.target.value })}
                                                placeholder="http://localhost:8000/generate"
                                                className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-amber-500/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Default Voice Name (e.g. Jasper)</label>
                                            <input
                                                type="text"
                                                value={settings.customTTSVoice || ''}
                                                onChange={(e) => onUpdate({ customTTSVoice: e.target.value })}
                                                placeholder="Jasper"
                                                className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-amber-500/50"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="space-y-3 pt-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm text-gray-700 dark:text-gray-300">Speech Rate ({settings.ttsRate}x)</label>
                                        <input
                                            type="range" min="0.5" max="2.0" step="0.1"
                                            value={settings.ttsRate}
                                            onChange={(e) => onUpdate({ ttsRate: Number(e.target.value) })}
                                            className="w-24 accent-emerald-500"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm text-gray-700 dark:text-gray-300">Volume ({Math.round(settings.ttsVolume * 100)}%)</label>
                                        <input
                                            type="range" min="0" max="1" step="0.1"
                                            value={settings.ttsVolume}
                                            onChange={(e) => onUpdate({ ttsVolume: Number(e.target.value) })}
                                            className="w-24 accent-emerald-500"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        const provider = getTTSProvider(settings);
                                        provider.speak("This is a test of your announcement system.", {
                                            rate: settings.ttsRate,
                                            volume: settings.ttsVolume,
                                            voiceId: settings.ttsVoiceId || undefined
                                        }).catch(e => console.error("Test voice failed", e));
                                    }}
                                    className="w-full py-2 mt-2 rounded-lg bg-emerald-600/20 text-emerald-400 text-sm font-medium hover:bg-emerald-600/30 transition-colors"
                                >
                                    ▶ Test Voice
                                </button>
                            </div>
                        )}
                    </section>

                    {/* ─── AI GENERATION ──────────────────────────────── */}
                    <section>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">AI Message Generation</h3>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm text-gray-700 dark:text-gray-300">Generate announcements with AI</span>
                            <button
                                onClick={() => onUpdate({ llmEnabled: !settings.llmEnabled })}
                                className={`relative w-11 h-6 rounded-full transition-colors ${settings.llmEnabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                            >
                                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${settings.llmEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        {settings.llmEnabled && (
                            <div className="space-y-4 pl-2 border-l-2 border-gray-200 dark:border-gray-800">
                                <div>
                                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">LLM Provider</label>
                                    <select
                                        value={settings.llmProvider || ''}
                                        onChange={(e) => onUpdate({ llmProvider: e.target.value as any })}
                                        className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-amber-500/50"
                                    >
                                        <option value="ollama">Ollama (Local)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Ollama API URL</label>
                                    <input
                                        type="text"
                                        value={settings.ollamaUrl || ''}
                                        onChange={(e) => onUpdate({ ollamaUrl: e.target.value })}
                                        placeholder="http://localhost:11434"
                                        className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-amber-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Ollama Model</label>
                                    <input
                                        type="text"
                                        value={settings.llmModel || ''}
                                        onChange={(e) => onUpdate({ llmModel: e.target.value })}
                                        placeholder="llama3.1"
                                        className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-amber-500/50"
                                    />
                                </div>
                                <p className="text-xs text-gray-500">Requires Ollama running locally.</p>
                            </div>
                        )}
                    </section>

                    {/* ─── RESET ──────────────────────────────────────── */}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                        <button
                            onClick={onReset}
                            className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium text-sm
                         hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <RotateCcw size={14} />
                            Reset All to Defaults
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import {
    X, RotateCcw, Volume2, VolumeX, Play, Upload, Loader2, RefreshCw, Trash2, Images, Cpu, GripVertical
} from 'lucide-react';
import { getTTSProvider } from '../lib/tts/getTTSProvider';
import type { AppSettings, MediaSlide } from '../lib/types';
import { SCALE_STEP, SCALE_MIN, SCALE_MAX } from '../lib/fontSizeUtils';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { appDataDir, join } from '@tauri-apps/api/path';
import { exists, mkdir } from '@tauri-apps/plugin-fs';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { check } from '@tauri-apps/plugin-updater';
import { audioManager } from '../lib/audioManager';
import AnnouncementScheduleEditor from './AnnouncementScheduleEditor';
import type { ExamTimer } from '../lib/types';
import { KOKORO_VOICES, KokoroTTSProvider } from '../lib/tts/KokoroTTSProvider';

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

function KokoroVoiceSelector({ settings, onUpdate }: { settings: AppSettings, onUpdate: (p: Partial<AppSettings>) => void }) {
    const [modelLoaded, setModelLoaded] = useState(KokoroTTSProvider.isLoaded);
    const [warming, setWarming] = useState(false);

    // Poll model status every second until loaded
    useEffect(() => {
        if (modelLoaded) return;
        const id = setInterval(() => {
            if (KokoroTTSProvider.isLoaded) {
                setModelLoaded(true);
                clearInterval(id);
            }
        }, 1000);
        return () => clearInterval(id);
    }, [modelLoaded]);

    const handleWarmUp = () => {
        setWarming(true);
        KokoroTTSProvider.warmUp();
        // Poll until loaded
        const id = setInterval(() => {
            if (KokoroTTSProvider.isLoaded) {
                setModelLoaded(true);
                setWarming(false);
                clearInterval(id);
            }
        }, 500);
    };

    // Group voices by language
    const usVoices  = KOKORO_VOICES.filter(v => v.lang === 'en-US');
    const gbVoices  = KOKORO_VOICES.filter(v => v.lang === 'en-GB');

    return (
        <div className="space-y-3">
            {/* Model status badge */}
            <div className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold ${
                modelLoaded
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
            }`}>
                <div className="flex items-center gap-1.5">
                    <Cpu size={13} />
                    {modelLoaded ? 'Model loaded — ready' : 'Model not yet loaded (~86 MB, one-time download)'}
                </div>
                {!modelLoaded && (
                    <button
                        onClick={handleWarmUp}
                        disabled={warming}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                    >
                        {warming ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                        {warming ? 'Loading…' : 'Load Now'}
                    </button>
                )}
            </div>

            {/* Voice picker */}
            <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Voice</label>
                <select
                    value={settings.kokoroVoiceId || 'af_bella'}
                    onChange={(e) => onUpdate({ kokoroVoiceId: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-transparent rounded-lg text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:bg-white dark:focus:bg-gray-900 transition-colors"
                >
                    <optgroup label="American English">
                        {usVoices.map(v => (
                            <option key={v.id} value={v.id}>{v.label}</option>
                        ))}
                    </optgroup>
                    <optgroup label="British English">
                        {gbVoices.map(v => (
                            <option key={v.id} value={v.id}>{v.label}</option>
                        ))}
                    </optgroup>
                </select>
                <p className="text-xs text-gray-500 mt-1">Neural voice — sounds identical on every machine.</p>
            </div>

            {/* Pre-warm lead time */}
            <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                    Pre-generate Audio Before Trigger
                </label>
                <div className="flex gap-1.5">
                    {[5, 10, 20, 30, 45].map(s => (
                        <button
                            key={s}
                            onClick={() => onUpdate({ kokoroPreWarmLeadSeconds: s })}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                (settings.kokoroPreWarmLeadSeconds ?? 20) === s
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-500/50'
                            }`}
                        >
                            {s}s
                        </button>
                    ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                    Starts generating audio {settings.kokoroPreWarmLeadSeconds ?? 20}s before the announcement fires so it plays instantly.
                </p>
            </div>
        </div>
    );
}



function TestVoiceButton({ settings }: { settings: AppSettings }) {
    const [testing, setTesting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTest = async () => {
        setError(null);
        setTesting(true);
        try {
            const provider = getTTSProvider(settings);
            // Kokoro uses kokoroVoiceId; Web Speech uses ttsVoiceId
            const voiceId = settings.ttsProvider === 'kokoro'
                ? settings.kokoroVoiceId
                : (settings.ttsVoiceId || undefined);
            await provider.speak('This is a test of your announcement system.', {
                rate: settings.ttsRate,
                volume: settings.ttsVolume,
                voiceId,
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            console.error('[TestVoice] Failed:', e);
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="mt-2 space-y-1">
            <button
                onClick={handleTest}
                disabled={testing}
                className="w-full py-2 rounded-lg bg-emerald-600/20 text-emerald-400 text-sm font-medium hover:bg-emerald-600/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
                {testing
                    ? <><Loader2 size={14} className="animate-spin" /> {settings.ttsProvider === 'kokoro' ? 'Generating…' : 'Speaking…'}</>
                    : <>▶ Test Voice</>
                }
            </button>
            {error && (
                <p className="text-xs text-red-500 dark:text-red-400 px-1">{error}</p>
            )}
        </div>
    );
}

export default function SettingsPanel({ settings, onUpdate, onReset, onClose }: SettingsPanelProps) {
    const [testPlaying, setTestPlaying] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
    const [updateMessage, setUpdateMessage] = useState<string | null>(null);
    const [isEditingDefaultSchedule, setIsEditingDefaultSchedule] = useState(false);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    const handleAddDefaultMedia = async () => {
        try {
            setIsUploadingMedia(true);
            const defaults = await invoke<MediaSlide[]>('ensure_default_slideshow_assets');
            // Check for duplicates (by name/path) before adding
            const existingPaths = new Set(settings.slideshowMedia.map(m => m.path));
            const newMedia = defaults.filter(d => !existingPaths.has(d.path));

            if (newMedia.length > 0) {
                onUpdate({
                    slideshowMedia: [...settings.slideshowMedia, ...newMedia]
                });
            }
        } catch (error) {
            console.error('Failed to load default media:', error);
            alert('Failed to load default images: ' + String(error));
        } finally {
            setIsUploadingMedia(false);
        }
    };

    const handleCheckUpdate = async () => {
        try {
            setIsCheckingUpdate(true);
            setUpdateMessage("Checking for updates...");
            const update = await check();
            if (update) {
                setUpdateMessage(`Downloading v${update.version}...`);
                await update.downloadAndInstall();
                setUpdateMessage("Update installed! Please restart the app.");
            } else {
                setUpdateMessage("You are up to date!");
            }
        } catch (error) {
            console.error("Updater error:", error);
            setUpdateMessage(`Failed: ${String(error)}`);
        } finally {
            setIsCheckingUpdate(false);
        }
    };

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

                        {/* Show Status Legend */}
                        <div className="flex items-center justify-between mt-4">
                            <span className="text-sm text-gray-700 dark:text-gray-300">Show Status Legend in Grid View</span>
                            <button
                                onClick={() => onUpdate({ showStatusLegend: !settings.showStatusLegend })}
                                className={`relative w-11 h-6 rounded-full transition-colors ${settings.showStatusLegend ? 'bg-emerald-500 dark:bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'
                                    }`}
                            >
                                <div
                                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${settings.showStatusLegend ? 'translate-x-5' : 'translate-x-0'
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

                        {/* Auto-dismiss */}
                        <div className="flex flex-col gap-3 mt-4 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-dismiss ended timers</span>
                                <button
                                    onClick={() => onUpdate({ autoDismissAfterSeconds: settings.autoDismissAfterSeconds ? null : 60 })}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${settings.autoDismissAfterSeconds ? 'bg-emerald-500 dark:bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                                >
                                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${settings.autoDismissAfterSeconds ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                            {settings.autoDismissAfterSeconds && (
                                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Dismiss after</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {[30, 60, 120, 300].map((sec) => (
                                            <button
                                                key={sec}
                                                onClick={() => onUpdate({ autoDismissAfterSeconds: sec })}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${settings.autoDismissAfterSeconds === sec
                                                    ? 'bg-emerald-600 text-white'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                    }`}
                                            >
                                                {sec < 60 ? `${sec}s` : `${sec / 60} min`}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Silences alarm and hides the end overlay automatically</p>
                                </div>
                            )}
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

                        <div className="mb-4">
                            <button
                                onClick={() => setIsEditingDefaultSchedule(true)}
                                className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                Manage Default Schedule
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
                                        <option value="kokoro">Kokoro AI Voice (Local — Recommended)</option>
                                        <option value="custom-api">Custom API (Local/KittenTTS)</option>
                                    </select>
                                </div>

                                {settings.ttsProvider === 'web-speech' && (
                                    <WebSpeechVoiceSelector settings={settings} onUpdate={onUpdate} />
                                )}
                                {settings.ttsProvider === 'kokoro' && (
                                    <KokoroVoiceSelector settings={settings} onUpdate={onUpdate} />
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
                                    {/* ── Repeat Count ── */}
                                    <div>
                                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                                            Repeat Each Announcement
                                        </label>
                                        <div className="flex gap-1.5">
                                            {[1, 2, 3, 4, 5].map(n => (
                                                <button
                                                    key={n}
                                                    onClick={() => onUpdate({ announcementRepeatCount: n })}
                                                    className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                                                        (settings.announcementRepeatCount ?? 1) === n
                                                            ? 'bg-emerald-600 border-emerald-600 text-white'
                                                            : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-500/50'
                                                    }`}
                                                >
                                                    {n}×
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {(settings.announcementRepeatCount ?? 1) === 1
                                                ? 'Each announcement is read once.'
                                                : `Each announcement is read ${settings.announcementRepeatCount} times with a 1.5s pause between repeats.`}
                                        </p>
                                    </div>

                                    {/* ── Speech Rate & Volume ── */}
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

                                <TestVoiceButton settings={settings} />
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

                    {/* ─── SLIDESHOW ────────────────────────────────── */}
                    <section>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Exam Notices Slideshow</h3>

                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2"><Images size={16} /> Enable Slideshow</span>
                            <button
                                onClick={() => onUpdate({ slideshowEnabled: !settings.slideshowEnabled })}
                                className={`relative w-11 h-6 rounded-full transition-colors ${settings.slideshowEnabled ? 'bg-violet-500 dark:bg-violet-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                            >
                                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${settings.slideshowEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {settings.slideshowEnabled && (
                            <div className="space-y-5 pl-2 border-l-2 border-violet-200 dark:border-violet-800">

                                {/* Backdrop Opacity */}
                                <div>
                                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                                        Backdrop Opacity — {settings.slideshowOpacity}%
                                    </label>
                                    <input
                                        type="range" min={5} max={100} step={1}
                                        value={settings.slideshowOpacity}
                                        onChange={(e) => onUpdate({ slideshowOpacity: Number(e.target.value) })}
                                        className="w-full accent-violet-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Lower = more transparent &bull; 100% = fully opaque background.</p>
                                </div>

                                {/* Image display time */}
                                <div>
                                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Image Display Time (seconds)</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {[3, 5, 10, 20, 30].map(s => (
                                            <button
                                                key={s}
                                                onClick={() => onUpdate({ slideshowSlideDuration: s })}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                                    settings.slideshowSlideDuration === s
                                                        ? 'bg-violet-600 text-white'
                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                }`}
                                            >{s}s</button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">How long each image stays on screen per visit.</p>
                                </div>

                                {/* Pause between slides */}
                                <div>
                                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Pause Between Slides (seconds)</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {[3, 5, 10, 15, 20].map(s => (
                                            <button
                                                key={s}
                                                onClick={() => onUpdate({ slideshowPauseDuration: s })}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                                    (settings.slideshowPauseDuration ?? 5) === s
                                                        ? 'bg-violet-600 text-white'
                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                }`}
                                            >{s}s</button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Grid is visible during this gap between each image.</p>
                                </div>

                                {/* Cycles per phase */}
                                <div>
                                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Cycles per Phase</label>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => onUpdate({ slideshowCycles: Math.max(1, (settings.slideshowCycles ?? 3) - 1) })}
                                            disabled={(settings.slideshowCycles ?? 3) <= 1}
                                            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold text-lg flex items-center justify-center"
                                        >−</button>
                                        <span className="text-gray-900 dark:text-white font-mono text-sm min-w-[2rem] text-center">
                                            {settings.slideshowCycles ?? 3}
                                        </span>
                                        <button
                                            onClick={() => onUpdate({ slideshowCycles: Math.min(10, (settings.slideshowCycles ?? 3) + 1) })}
                                            disabled={(settings.slideshowCycles ?? 3) >= 10}
                                            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold text-lg flex items-center justify-center"
                                        >+</button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">How many times the full image sequence repeats per phase window.</p>
                                </div>

                                {/* Phase timing */}
                                <div className="space-y-2">
                                    <label className="block text-sm text-gray-700 dark:text-gray-300">Phase Window Durations</label>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-500">Start phase (first N min)</span>
                                        <input
                                            type="number" min={1} max={30} value={settings.slideshowPhaseStartMinutes}
                                            onChange={(e) => onUpdate({ slideshowPhaseStartMinutes: Number(e.target.value) })}
                                            className="w-16 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white text-center focus:outline-none"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-500">End phase (last N min)</span>
                                        <input
                                            type="number" min={1} max={60} value={settings.slideshowPhaseEndMinutes}
                                            onChange={(e) => onUpdate({ slideshowPhaseEndMinutes: Number(e.target.value) })}
                                            className="w-16 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white text-center focus:outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Phase enable checkboxes */}
                                <div>
                                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Auto-show in phases</label>
                                    <div className="space-y-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                                        {([
                                            { key: 'slideshowPhaseStart' as const, label: 'Start phase', color: 'bg-blue-500' },
                                            { key: 'slideshowPhaseMiddle' as const, label: 'Middle phase', color: 'bg-gray-500' },
                                            { key: 'slideshowPhaseEnd' as const, label: 'End phase', color: 'bg-amber-500' },
                                        ]).map(({ key, label, color }) => {
                                            const val = (settings[key] as boolean) ?? true;
                                            return (
                                                <div key={key} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${color}`} />
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => onUpdate({ [key]: !val })}
                                                        className={`relative w-11 h-6 rounded-full transition-colors ${val ? 'bg-violet-500 dark:bg-violet-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                                                    >
                                                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${val ? 'translate-x-5' : 'translate-x-0'}`} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Slideshow auto-fires for the configured number of cycles when the selected phase window begins.</p>
                                </div>

                                {/* Media files */}
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm text-gray-700 dark:text-gray-300">
                                        Media Files ({settings.slideshowMedia.length})
                                    </label>
                                    <button
                                        onClick={handleAddDefaultMedia}
                                        disabled={isUploadingMedia}
                                        className="text-[10px] font-bold text-violet-500 hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300 uppercase tracking-widest flex items-center gap-1 transition-colors"
                                    >
                                        <RotateCcw size={10} /> Restore Defaults
                                    </button>
                                </div>

                                {settings.slideshowMedia.length > 0 && (
                                    <div className="space-y-2 mb-3">
                                        {settings.slideshowMedia.map((slide) => (
                                            <div
                                                key={slide.id}
                                                data-slide-id={slide.id}
                                                className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                                                    draggedId === slide.id ? 'opacity-50 scale-[0.98]' : 'bg-gray-50 dark:bg-gray-800'
                                                } ${
                                                    dragOverId === slide.id ? 'border-[2px] border-violet-500 bg-violet-50 dark:bg-violet-900/20 shadow-[0_0_15px_rgba(139,92,246,0.3)]' : 'border border-gray-200 dark:border-gray-700'
                                                }`}
                                            >
                                                <div 
                                                    className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 touch-none shrink-0"
                                                    onPointerDown={(e) => {
                                                        e.currentTarget.setPointerCapture(e.pointerId);
                                                        setDraggedId(slide.id);
                                                    }}
                                                    onPointerMove={(e) => {
                                                        if (!draggedId) return;
                                                        // Temporarily disable pointer-events on the grip element itself 
                                                        // if it gets in the way of elementFromPoint
                                                        const el = e.currentTarget;
                                                        const prevEvents = el.style.pointerEvents;
                                                        el.style.pointerEvents = 'none';

                                                        const testEl = document.elementFromPoint(e.clientX, e.clientY);
                                                        el.style.pointerEvents = prevEvents;

                                                        const targetSlideEl = testEl?.closest('[data-slide-id]');
                                                        if (targetSlideEl) {
                                                            const id = targetSlideEl.getAttribute('data-slide-id');
                                                            setDragOverId(id !== draggedId ? id : null);
                                                        } else {
                                                            setDragOverId(null);
                                                        }
                                                    }}
                                                    onPointerUp={(e) => {
                                                        e.currentTarget.releasePointerCapture(e.pointerId);
                                                        if (draggedId && dragOverId && draggedId !== dragOverId) {
                                                            const oldIndex = settings.slideshowMedia.findIndex(m => m.id === draggedId);
                                                            const newIndex = settings.slideshowMedia.findIndex(m => m.id === dragOverId);
                                                            if (oldIndex !== -1 && newIndex !== -1) {
                                                                const newList = [...settings.slideshowMedia];
                                                                const [moved] = newList.splice(oldIndex, 1);
                                                                newList.splice(newIndex, 0, moved);
                                                                onUpdate({ slideshowMedia: newList });
                                                            }
                                                        }
                                                        setDraggedId(null);
                                                        setDragOverId(null);
                                                    }}
                                                    onPointerCancel={() => {
                                                        setDraggedId(null);
                                                        setDragOverId(null);
                                                    }}
                                                >
                                                    <GripVertical size={16} />
                                                </div>
                                                <div className="w-12 h-12 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0 overflow-hidden relative border border-gray-300 dark:border-gray-600">
                                                    {slide.type === 'image' ? (
                                                        <img src={convertFileSrc(slide.path)} alt="" className="w-full h-full object-cover pointer-events-none" />
                                                    ) : (
                                                        <>
                                                            <video src={convertFileSrc(slide.path)} className="w-full h-full object-cover opacity-60 pointer-events-none" />
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <Play size={14} className="text-white drop-shadow-md" fill="currentColor" />
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{slide.name}</p>
                                                    <div className="flex gap-1 mt-0.5">
                                                        {(['start', 'middle', 'end'] as const).map(phase => (
                                                            <button
                                                                key={phase}
                                                                onClick={() => {
                                                                    const updated = settings.slideshowMedia.map(m =>
                                                                        m.id === slide.id
                                                                            ? { ...m, phases: m.phases.includes(phase) ? m.phases.filter(p => p !== phase) : [...m.phases, phase] }
                                                                            : m
                                                                    );
                                                                    onUpdate({ slideshowMedia: updated });
                                                                }}
                                                                className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase transition-colors ${slide.phases.includes(phase)
                                                                    ? phase === 'start' ? 'bg-blue-500 text-white' : phase === 'middle' ? 'bg-gray-500 text-white' : 'bg-amber-500 text-white'
                                                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                                                                }`}
                                                            >{phase}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        await invoke('delete_media_file', { filePath: slide.path }).catch(() => { });
                                                        onUpdate({ slideshowMedia: settings.slideshowMedia.filter(m => m.id !== slide.id) });
                                                    }}
                                                    className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                                                    title="Remove"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <button
                                    disabled={isUploadingMedia}
                                    onClick={async () => {
                                        try {
                                            setIsUploadingMedia(true);
                                            const selected = await openDialog({
                                                multiple: true,
                                                filters: [{ name: 'Media', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'] }]
                                            }) as string[] | null;

                                            if (!selected || selected.length === 0) return;

                                            const dataDir = await appDataDir();
                                            const mediaDir = await join(dataDir, 'slideshow');
                                            if (!(await exists(mediaDir))) await mkdir(mediaDir, { recursive: true });

                                            const newSlides: import('../lib/types').MediaSlide[] = [];
                                            for (const srcPath of selected) {
                                                const fname = srcPath.split(/[/\\]/).pop() || 'media';
                                                const ext = fname.split('.').pop()?.toLowerCase() || '';
                                                const isVideo = ['mp4', 'webm', 'mov'].includes(ext);
                                                const sanitized = fname.replace(/[^a-zA-Z0-9._\-]/g, '_');
                                                const targetPath = await join(mediaDir, `${Date.now()}_${sanitized}`);
                                                await invoke('copy_media_file', { sourcePath: srcPath, targetPath });
                                                newSlides.push({
                                                    id: `slide-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                                    path: targetPath,
                                                    name: fname,
                                                    type: isVideo ? 'video' : 'image',
                                                    phases: ['start', 'middle', 'end'],
                                                });
                                            }
                                            onUpdate({ slideshowMedia: [...settings.slideshowMedia, ...newSlides] });
                                        } catch (err) {
                                            console.error('Media upload error:', err);
                                            alert('Failed to add media: ' + String(err));
                                        } finally {
                                            setIsUploadingMedia(false);
                                        }
                                    }}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition disabled:opacity-50"
                                >
                                    {isUploadingMedia ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                    {isUploadingMedia ? 'Copying...' : 'Add Images / Videos'}
                                </button>
                                <p className="text-xs text-gray-500 mt-1.5">Toggle phase tags (Start / Middle / End) on each slide to control when it appears automatically.</p>
                            </div>
                        )}
                    </section>

                    {/* ─── UPDATES ────────────────────────────────────────── */}
                    <section>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Software Updates</h3>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={handleCheckUpdate}
                                disabled={isCheckingUpdate}
                                className="w-full py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium text-sm
                         hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isCheckingUpdate ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
                            </button>
                            {updateMessage && (
                                <p className="text-xs text-center text-gray-600 dark:text-gray-400 mt-1">
                                    {updateMessage}
                                </p>
                            )}
                        </div>
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

            {/* Default Schedule Editor Modal */}
            {isEditingDefaultSchedule && (
                <AnnouncementScheduleEditor
                    timer={{
                        // Dummy ExamTimer for preview purposes
                        id: 'dummy-default',
                        mode: 'exam',
                        label: '[Dummy Label]',
                        durationSeconds: 3600,
                        remainingSeconds: 3600,
                        status: 'Idle',
                        isDismissed: false,
                        fontSizeOverride: null,
                        endTimeUnix: null,
                        courseCode: '[Course Code]',
                        courseTitle: '[Course Title]',
                        program: '[Program]',
                        studentCount: 0,
                        announcementSchedule: settings.defaultAnnouncementSchedule,
                    } as ExamTimer}
                    settings={settings}
                    onSave={(newSchedule) => {
                        onUpdate({ defaultAnnouncementSchedule: newSchedule });
                        setIsEditingDefaultSchedule(false);
                    }}
                    onClose={() => setIsEditingDefaultSchedule(false)}
                />
            )}
        </div>
    );
}

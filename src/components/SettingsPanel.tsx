import { X, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { AppSettings } from '../lib/types';
import { SCALE_STEP, SCALE_MIN, SCALE_MAX } from '../lib/fontSizeUtils';

interface SettingsPanelProps {
    settings: AppSettings;
    onUpdate: (patch: Partial<AppSettings>) => void;
    onReset: () => void;
    onClose: () => void;
}

export default function SettingsPanel({ settings, onUpdate, onReset, onClose }: SettingsPanelProps) {
    return (
        <div className="fixed inset-0 z-40 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="relative w-[420px] bg-gray-900 border-l border-gray-800 h-full overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        ⚙ Settings
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
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
                            <label className="block text-sm text-gray-300 mb-2">Global Font Size</label>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => onUpdate({ globalFontScale: Math.max(SCALE_MIN, settings.globalFontScale - SCALE_STEP) })}
                                    disabled={settings.globalFontScale <= SCALE_MIN}
                                    className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 
                             disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-bold"
                                >
                                    A−
                                </button>
                                <span className="text-white font-mono text-sm min-w-[3rem] text-center">
                                    {settings.globalFontScale}%
                                </span>
                                <button
                                    onClick={() => onUpdate({ globalFontScale: Math.min(SCALE_MAX, settings.globalFontScale + SCALE_STEP) })}
                                    disabled={settings.globalFontScale >= SCALE_MAX}
                                    className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 
                             disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-bold"
                                >
                                    A+
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Affects all timers with no override</p>
                        </div>

                        {/* Show Progress Bar */}
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm text-gray-300">Show Progress Bar</span>
                            <button
                                onClick={() => onUpdate({ showProgressBar: !settings.showProgressBar })}
                                className={`relative w-11 h-6 rounded-full transition-colors ${settings.showProgressBar ? 'bg-emerald-600' : 'bg-gray-700'
                                    }`}
                            >
                                <div
                                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${settings.showProgressBar ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                />
                            </button>
                        </div>

                        {/* Dark Mode */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-300">Dark Mode</span>
                            <button
                                onClick={() => onUpdate({ darkMode: !settings.darkMode })}
                                className={`relative w-11 h-6 rounded-full transition-colors ${settings.darkMode ? 'bg-emerald-600' : 'bg-gray-700'
                                    }`}
                            >
                                <div
                                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${settings.darkMode ? 'translate-x-5' : 'translate-x-0'
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
                                <span className="text-sm text-gray-300">Warning threshold</span>
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
                                        className="w-16 px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 
                               text-white text-center text-sm focus:outline-none focus:border-amber-500/50"
                                    />
                                    <span className="text-gray-400 text-xs">min</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-300">Critical threshold</span>
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
                                        className="w-16 px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 
                               text-white text-center text-sm focus:outline-none focus:border-amber-500/50"
                                    />
                                    <span className="text-gray-400 text-xs">min</span>
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
                            <span className="text-sm text-gray-300 flex items-center gap-2">
                                {settings.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                                Sound on timer end
                            </span>
                            <button
                                onClick={() => onUpdate({ soundEnabled: !settings.soundEnabled })}
                                className={`relative w-11 h-6 rounded-full transition-colors ${settings.soundEnabled ? 'bg-emerald-600' : 'bg-gray-700'
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
                            <label className="block text-sm text-gray-300 mb-2">
                                Volume — {Math.round(settings.alarmVolume * 100)}%
                            </label>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={Math.round(settings.alarmVolume * 100)}
                                onChange={(e) => onUpdate({ alarmVolume: Number(e.target.value) / 100 })}
                                className="w-full accent-emerald-500"
                            />
                        </div>
                    </section>

                    {/* ─── END STATE ──────────────────────────────────── */}
                    <section>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">End State</h3>
                        <div>
                            <label className="block text-sm text-gray-300 mb-1.5">Message on screen</label>
                            <input
                                type="text"
                                value={settings.endMessage}
                                onChange={(e) => onUpdate({ endMessage: e.target.value.slice(0, 60) })}
                                maxLength={60}
                                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 
                           text-white text-sm focus:outline-none focus:border-amber-500/50"
                            />
                            <p className="text-xs text-gray-500 mt-1">{settings.endMessage.length}/60 characters</p>
                        </div>
                    </section>

                    {/* ─── RESET ──────────────────────────────────────── */}
                    <div className="pt-4 border-t border-gray-800">
                        <button
                            onClick={onReset}
                            className="w-full py-2.5 rounded-xl bg-gray-800 text-gray-300 font-medium text-sm
                         hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
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

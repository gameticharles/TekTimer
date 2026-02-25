import { useState } from 'react';
import { X, Mic, RefreshCw, Send, Sparkles } from 'lucide-react';
import type { AppSettings, AnyTimer } from '../lib/types';
import { resolveTemplate, enhanceWithLLM, announcementQueue } from '../lib/announcements';

interface AnnouncementModalProps {
    settings: AppSettings;
    timers: AnyTimer[];
    onClose: () => void;
}

export default function AnnouncementModal({ settings, timers, onClose }: AnnouncementModalProps) {
    const [targetTimerId, setTargetTimerId] = useState<string>('all');
    const [customText, setCustomText] = useState('');
    const [llmIntent, setLlmIntent] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const getPreviewText = (text: string) => {
        if (targetTimerId === 'all') return text;
        const timer = timers.find(t => t.id === targetTimerId);
        if (!timer) return text;
        const prefix = 'courseCode' in timer ? `${timer.courseCode}: ` : `${timer.label}: `;
        return resolveTemplate(prefix + text, timer);
    };

    const handleQuickAdd = (msg: string) => {
        announcementQueue.enqueue({
            id: `manual-quick-${Date.now()}`,
            text: getPreviewText(msg),
            priority: 0,
        });
        onClose();
    };

    const handleSpeakNow = (text: string) => {
        if (!text.trim()) return;
        announcementQueue.enqueue({
            id: `manual-${Date.now()}`,
            text: getPreviewText(text),
            priority: 0,
        });
        onClose();
    };

    const handleQueue = (text: string) => {
        if (!text.trim()) return;
        announcementQueue.enqueue({
            id: `manual-queued-${Date.now()}`,
            text: getPreviewText(text),
            priority: 2,
        });
        onClose();
    };

    const handleGenerate = async () => {
        if (!llmIntent.trim()) return;
        setIsGenerating(true);
        let ctxTimer = timers.find(t => t.id === targetTimerId) || timers[0];
        const contextPrefix = ctxTimer
            ? (`Context: ${'courseCode' in ctxTimer ? ctxTimer.courseCode : ctxTimer.label} · ${Math.floor(ctxTimer.remainingSeconds / 60)} mins remaining \n`)
            : '';
        const baseText = `[Intent: ${llmIntent}]. ${contextPrefix}`;
        const generated = await enhanceWithLLM(baseText, settings);
        setCustomText(generated);
        setIsGenerating(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-800/50">
                    <div className="flex items-center gap-3 text-emerald-400">
                        <Mic size={20} />
                        <h2 className="text-lg font-bold text-white">Manual Announcement</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Target Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Target Audience</label>
                        <select
                            value={targetTimerId}
                            onChange={(e) => setTargetTimerId(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500/50"
                        >
                            <option value="all">🌐 All Timers (No Prefix)</option>
                            {timers.map(t => (
                                <option key={t.id} value={t.id}>
                                    🎯 {'courseCode' in t ? t.courseCode : t.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Quick Buttons */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Quick Messages (Interrupts immediately)</label>
                        <div className="grid grid-cols-2 gap-2">
                            {settings.quickPickMessages.map((msg, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleQuickAdd(msg)}
                                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-2 rounded-lg text-sm text-left truncate transition-colors border border-transparent hover:border-gray-600"
                                    title={msg}
                                >
                                    {msg}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* AI Generation */}
                    {settings.llmEnabled && (
                        <div className="p-4 bg-emerald-900/20 border border-emerald-900/50 rounded-xl space-y-3">
                            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                                <Sparkles size={16} />
                                Generate with AI
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="e.g., 'remind students to bring their IDs'"
                                    value={llmIntent}
                                    onChange={e => setLlmIntent(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                                    className="flex-1 bg-gray-800/50 border border-emerald-900/30 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                                />
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !llmIntent.trim()}
                                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:text-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    {isGenerating ? <RefreshCw size={14} className="animate-spin" /> : 'Generate'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Custom Text Area */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Custom Message</label>
                        <textarea
                            value={customText}
                            onChange={(e) => setCustomText(e.target.value)}
                            placeholder="Type your announcement here... Use {program}, {courseCode} for substitutions."
                            rows={3}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 resize-none font-medium"
                        />
                        {customText.trim() && (
                            <div className="mt-2 text-sm text-gray-500 bg-gray-800/50 p-3 rounded-lg border border-gray-800">
                                <span className="font-semibold text-gray-400">Preview: </span>
                                <span className="italic text-gray-300">"{getPreviewText(customText)}"</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-800 flex justify-end gap-3">
                    <button
                        onClick={() => handleQueue(customText)}
                        disabled={!customText.trim()}
                        className="px-5 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 font-medium transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                    >
                        Add to Queue
                    </button>
                    <button
                        onClick={() => handleSpeakNow(customText)}
                        disabled={!customText.trim()}
                        className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors disabled:opacity-50 disabled:hover:bg-emerald-600 flex items-center gap-2"
                    >
                        <Send size={16} />
                        Speak Now
                    </button>
                </div>
            </div>
        </div>
    );
}

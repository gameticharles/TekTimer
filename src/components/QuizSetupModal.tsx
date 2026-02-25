import { useState } from 'react';
import { X } from 'lucide-react';

interface QuizSetupModalProps {
    onStart: (label: string, durationSeconds: number, startImmediately: boolean) => void;
    onClose: () => void;
}

export default function QuizSetupModal({ onStart, onClose }: QuizSetupModalProps) {
    const [label, setLabel] = useState('');
    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(30);
    const [startImmediately, setStartImmediately] = useState(true);

    const totalSeconds = hours * 3600 + minutes * 60;
    const isValid = totalSeconds >= 60; // Min 1 minute

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;
        onStart(label || 'Quiz Timer', totalSeconds, startImmediately);
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-[440px] shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                    <h2 className="text-xl font-bold text-white">New Quiz Timer</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Label */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            Label <span className="text-gray-500">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="e.g. Midterm Quiz"
                            maxLength={60}
                            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 
                         text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50
                         focus:ring-1 focus:ring-amber-500/20 transition-colors"
                        />
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            Duration
                        </label>
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={0}
                                        max={9}
                                        value={hours}
                                        onChange={(e) => setHours(Math.min(9, Math.max(0, Number(e.target.value))))}
                                        className="w-20 px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 
                               text-white text-center text-lg font-mono focus:outline-none 
                               focus:border-amber-500/50 transition-colors"
                                    />
                                    <span className="text-gray-400 text-sm">hours</span>
                                </div>
                            </div>
                            <span className="text-gray-600 text-2xl font-light">:</span>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={0}
                                        max={59}
                                        value={minutes}
                                        onChange={(e) => setMinutes(Math.min(59, Math.max(0, Number(e.target.value))))}
                                        className="w-20 px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 
                               text-white text-center text-lg font-mono focus:outline-none 
                               focus:border-amber-500/50 transition-colors"
                                    />
                                    <span className="text-gray-400 text-sm">minutes</span>
                                </div>
                            </div>
                        </div>
                        {!isValid && (hours > 0 || minutes > 0) && (
                            <p className="text-red-400 text-xs mt-1.5">Minimum duration is 1 minute</p>
                        )}
                    </div>

                    {/* Start Immediately */}
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={startImmediately}
                            onChange={(e) => setStartImmediately(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500 
                         focus:ring-amber-500/20 focus:ring-offset-0"
                        />
                        <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                            Start immediately
                        </span>
                    </label>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={!isValid}
                        className="w-full py-3 rounded-xl bg-amber-500 text-gray-900 font-bold text-lg
                       hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors shadow-lg shadow-amber-500/20"
                    >
                        Start Quiz
                    </button>
                </form>
            </div>
        </div>
    );
}

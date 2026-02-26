import { useState } from 'react';
import { X } from 'lucide-react';
import type { QuizTimer } from '../lib/types';

interface EditQuizTimerModalProps {
    timer: QuizTimer;
    onUpdate: (label: string, durationSeconds: number) => void;
    onClose: () => void;
}

export default function EditQuizTimerModal({ timer, onUpdate, onClose }: EditQuizTimerModalProps) {
    const [label, setLabel] = useState(timer.label);
    const [hours, setHours] = useState(Math.floor(timer.durationSeconds / 3600));
    const [minutes, setMinutes] = useState(Math.floor((timer.durationSeconds % 3600) / 60));

    const totalSeconds = hours * 3600 + minutes * 60;
    const isValid = totalSeconds >= 60; // Min 1 minute

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;
        onUpdate(label || 'Quiz Timer', totalSeconds);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 transition-colors">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-[440px] shadow-2xl transition-colors">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 transition-colors">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Quiz Timer</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Label */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 transition-colors">
                            Label <span className="text-gray-400 dark:text-gray-500">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="e.g. Midterm Quiz"
                            maxLength={100}
                            className="w-full px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                         text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-500/50
                         focus:ring-1 focus:ring-amber-500/20 transition-colors"
                        />
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 transition-colors">
                            New Total Duration
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
                                        className="w-20 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                               text-gray-900 dark:text-white text-center text-lg font-mono focus:outline-none 
                               focus:border-amber-500/50 transition-colors"
                                    />
                                    <span className="text-gray-500 dark:text-gray-400 text-sm">hours</span>
                                </div>
                            </div>
                            <span className="text-gray-400 dark:text-gray-600 text-2xl font-light transition-colors">:</span>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={0}
                                        max={59}
                                        value={minutes}
                                        onChange={(e) => setMinutes(Math.min(59, Math.max(0, Number(e.target.value))))}
                                        className="w-20 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                               text-gray-900 dark:text-white text-center text-lg font-mono focus:outline-none 
                               focus:border-amber-500/50 transition-colors"
                                    />
                                    <span className="text-gray-500 dark:text-gray-400 text-sm">minutes</span>
                                </div>
                            </div>
                        </div>
                        {!isValid && (hours > 0 || minutes > 0) && (
                            <p className="text-red-500 dark:text-red-400 text-xs mt-1.5">Minimum duration is 1 minute</p>
                        )}
                        <p className="text-gray-400 text-[10px] mt-2 italic">
                            Updating the duration will shift the remaining time proportionally.
                        </p>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={!isValid}
                        className="w-full py-3 rounded-xl bg-amber-500 text-gray-900 font-bold text-lg
                       hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors shadow-lg shadow-amber-500/20"
                    >
                        Save Changes
                    </button>
                </form>
            </div>
        </div>
    );
}

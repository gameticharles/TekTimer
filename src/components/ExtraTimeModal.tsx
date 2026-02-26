import { useState } from 'react';
import { X } from 'lucide-react';

interface ExtraTimeModalProps {
    timerLabel: string;
    onAddTime: (seconds: number) => void;
    onClose: () => void;
}

const QUICK_OPTIONS = [
    { label: '+15 min', seconds: 15 * 60 },
    { label: '+30 min', seconds: 30 * 60 },
    { label: '+45 min', seconds: 45 * 60 },
    { label: '+60 min', seconds: 60 * 60 },
];

export default function ExtraTimeModal({ timerLabel, onAddTime, onClose }: ExtraTimeModalProps) {
    const [customMinutes, setCustomMinutes] = useState('');

    const handleCustomAdd = () => {
        const mins = parseInt(customMinutes, 10);
        if (mins > 0) {
            onAddTime(mins * 60);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-40 transition-colors">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-[400px] shadow-2xl transition-colors">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 transition-colors">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white transition-colors">Add Extra Time</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6">
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 transition-colors">{timerLabel}</p>

                    {/* Quick add buttons */}
                    <div className="grid grid-cols-2 gap-2 mb-5">
                        {QUICK_OPTIONS.map((opt) => (
                            <button
                                key={opt.seconds}
                                onClick={() => {
                                    onAddTime(opt.seconds);
                                    onClose();
                                }}
                                className="py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold text-sm
                           hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 transition-colors"
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Custom */}
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400 text-sm transition-colors">Custom:</span>
                        <input
                            type="number"
                            min={1}
                            value={customMinutes}
                            onChange={(e) => setCustomMinutes(e.target.value)}
                            placeholder="0"
                            className="w-20 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                         text-gray-900 dark:text-white text-center text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCustomAdd();
                            }}
                        />
                        <span className="text-gray-500 dark:text-gray-400 text-sm transition-colors">minutes</span>
                        <button
                            onClick={handleCustomAdd}
                            disabled={!customMinutes || parseInt(customMinutes, 10) <= 0}
                            className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium text-sm
                         hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Add
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

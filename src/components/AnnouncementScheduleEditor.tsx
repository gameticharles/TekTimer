import { useState, useMemo } from 'react';
import { X, Plus, Trash2, RotateCcw } from 'lucide-react';
import type { AnyTimer, AppSettings, AnnouncementEntry } from '../lib/types';
import { resolveTemplate } from '../lib/announcements';

interface Props {
    timer: AnyTimer;
    settings: AppSettings;
    onSave: (schedule: AnnouncementEntry[]) => void;
    onClose: () => void;
}

export default function AnnouncementScheduleEditor({ timer, settings, onSave, onClose }: Props) {
    const [schedule, setSchedule] = useState<AnnouncementEntry[]>(timer.announcementSchedule || []);

    const handleUpdate = (id: string, patch: Partial<AnnouncementEntry>) => {
        setSchedule(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
    };

    const handleDelete = (id: string) => {
        setSchedule(prev => prev.filter(e => e.id !== id));
    };

    const handleAdd = () => {
        setSchedule(prev => [
            ...prev,
            {
                id: `custom-${Date.now()}`,
                triggerAtSeconds: 0,
                message: 'New announcement message...',
                enabled: true,
                hasBeenSpoken: false
            }
        ]);
    };

    const handleReset = () => {
        if (confirm("Reset to default schedule? All custom announcements will be lost.")) {
            setSchedule(settings.defaultAnnouncementSchedule.map(a => ({ ...a, id: `${a.id}-${Date.now()}`, hasBeenSpoken: false })));
        }
    };

    const handleSave = () => {
        onSave(schedule);
        onClose();
    };

    const sortedSchedule = useMemo(() => {
        return [...schedule].sort((a, b) => b.triggerAtSeconds - a.triggerAtSeconds);
    }, [schedule]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col h-[80vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-800/50 shrink-0">
                    <h2 className="text-lg font-bold text-white">
                        Announcement Schedule — {'courseCode' in timer ? timer.courseCode : timer.label}
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {sortedSchedule.map((entry) => (
                        <div key={entry.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex gap-4">

                            {/* Left Column: Time & Controls */}
                            <div className="w-24 shrink-0 flex flex-col gap-3">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Min Left</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={Math.floor(entry.triggerAtSeconds / 60)}
                                        onChange={(e) => handleUpdate(entry.id, { triggerAtSeconds: Math.max(0, parseInt(e.target.value) || 0) * 60 })}
                                        className="w-full bg-gray-900 border border-gray-600 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div className="flex items-center gap-2 mt-auto">
                                    <button
                                        onClick={() => handleUpdate(entry.id, { enabled: !entry.enabled })}
                                        className={`relative w-10 h-5 rounded-full transition-colors ${entry.enabled ? 'bg-emerald-600' : 'bg-gray-600'}`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${entry.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                    <button onClick={() => handleDelete(entry.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Right Column: Message & Preview */}
                            <div className="flex-1 min-w-0 flex flex-col gap-2">
                                <textarea
                                    value={entry.message}
                                    onChange={(e) => handleUpdate(entry.id, { message: e.target.value })}
                                    rows={2}
                                    className={`w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none ${!entry.enabled && 'opacity-50'}`}
                                />

                                {entry.enabled && entry.message.trim() && (
                                    <div className="text-xs text-gray-500 bg-gray-900/50 p-2 rounded border border-gray-800 line-clamp-2">
                                        <span className="font-semibold text-gray-400">Preview: </span>
                                        <span className="italic text-gray-300">"{resolveTemplate(entry.message, timer)}"</span>
                                    </div>
                                )}
                            </div>

                        </div>
                    ))}

                    {schedule.length === 0 && (
                        <p className="text-center text-gray-500 py-8">No announcements scheduled.</p>
                    )}
                </div>

                {/* Variable Hints */}
                <div className="px-6 py-3 bg-gray-900 border-t border-gray-800 text-xs text-gray-500 shrink-0">
                    Variables: {'{program}'}, {'{courseCode}'}, {'{remainingMinutes}'}, {'{remainingWords}'}, {'{totalMinutes}'}, {'{studentCount}'}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-800/80 border-t border-gray-800 flex justify-between shrink-0">
                    <div className="flex gap-2">
                        <button
                            onClick={handleAdd}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-700 text-white font-medium hover:bg-gray-600 transition-colors text-sm"
                        >
                            <Plus size={16} /> Add Entry
                        </button>
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-gray-400 font-medium hover:text-white hover:bg-gray-700 transition-colors text-sm"
                        >
                            <RotateCcw size={14} /> Defaults
                        </button>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 font-medium transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleSave} className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors">
                            Save Schedule
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

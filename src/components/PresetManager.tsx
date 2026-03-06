import { useState } from 'react';
import { Settings, Plus, Trash2, X, Edit3, Save, Image, Upload, CheckCircle2, ClipboardList } from 'lucide-react';
import { open, ask } from '@tauri-apps/plugin-dialog';
import type { TimerPreset, AppSettings, ExamTimer, QuizTimer } from '../lib/types';
import AddExamTimerModal from './AddExamTimerModal';
import QuizSetupModal from './QuizSetupModal';

interface Props {
    settings: AppSettings;
    onUpdate: (patch: Partial<AppSettings>) => void;
    onClose: () => void;
}

export default function PresetManager({ settings, onUpdate, onClose }: Props) {
    const [presets, setPresets] = useState<TimerPreset[]>(
        (settings.savedPresets || []).map(p => ({ ...p, status: p.status || 'Idle' }))
    );
    const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
    const [showAddExam, setShowAddExam] = useState(false);
    const [showAddQuiz, setShowAddQuiz] = useState(false);

    const activePreset = presets.find(p => p.id === editingPresetId);

    const handleSave = () => {
        onUpdate({ savedPresets: presets });
        onClose();
    };

    const handleCreateNewPreset = () => {
        const newPreset: TimerPreset = {
            id: `preset-${Date.now()}`,
            name: `New Hall ${presets.length + 1}`,
            status: 'Idle',
            timers: []
        };
        setPresets(prev => [...prev, newPreset]);
        setEditingPresetId(newPreset.id);
    };

    const handleDeletePreset = async (id: string) => {
        const confirmed = await ask("Are you sure you want to delete this hall preset?", {
            title: 'Confirm Deletion',
            kind: 'warning',
        });
        if (confirmed) {
            setPresets(prev => prev.filter(p => p.id !== id));
            if (editingPresetId === id) setEditingPresetId(null);
        }
    };

    const handleRenamePreset = (id: string, newName: string) => {
        setPresets(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
    };

    const handleUpdatePresetField = (id: string, field: 'session' | 'scheduledStartTime' | 'scheduledDate' | 'remark', value: string) => {
        setPresets(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const handleAddExamTimer = (
        courseCode: string,
        courseTitle: string | undefined,
        program: string,
        studentCount: number,
        durationSeconds: number
    ) => {
        if (!activePreset) return;

        // Auto-save new course if it doesn't exist
        const isNewCourse = !settings.savedCourses.some(c => c.code === courseCode);
        if (isNewCourse) {
            const levelMatch = courseCode.match(/\d{3}/);
            const yearLevel = levelMatch ? parseInt(levelMatch[0][0]) : 1;
            const newCourse = {
                code: courseCode,
                title: courseTitle || '',
                program: program,
                yearLevel,
                recommendedStudentCount: studentCount
            };
            onUpdate({ savedCourses: [...settings.savedCourses, newCourse] });
        }

        const label = [courseCode, courseTitle, program].filter(Boolean).join(' · ');
        const newTimer: ExamTimer = {
            id: `ptimer-${Date.now()}`,
            label,
            durationSeconds,
            remainingSeconds: durationSeconds,
            status: 'Idle',
            isDismissed: false,
            fontSizeOverride: null,
            endTimeUnix: null,
            mode: 'exam',
            courseCode,
            courseTitle,
            program,
            studentCount,
            announcementSchedule: settings.defaultAnnouncementSchedule.map(a => ({ ...a, id: `${a.id}-${Date.now()}` }))
        };

        setPresets(prev => prev.map(p => {
            if (p.id !== activePreset.id) return p;
            return { ...p, timers: [...p.timers, newTimer] };
        }));
        setShowAddExam(false);
    };

    const handleAddQuizTimer = (label: string, durationSeconds: number) => {
        if (!activePreset) return;
        const newTimer: QuizTimer = {
            id: `ptimer-${Date.now()}`,
            label,
            durationSeconds,
            remainingSeconds: durationSeconds,
            status: 'Idle',
            isDismissed: false,
            fontSizeOverride: null,
            endTimeUnix: null,
            mode: 'quiz',
            announcementSchedule: settings.defaultAnnouncementSchedule.map(a => ({ ...a, id: `${a.id}-${Date.now()}` }))
        };

        setPresets(prev => prev.map(p => {
            if (p.id !== activePreset.id) return p;
            return { ...p, timers: [...p.timers, newTimer] };
        }));
        setShowAddQuiz(false);
    };

    const handleRemoveTimer = (presetId: string, timerId: string) => {
        setPresets(prev => prev.map(p => {
            if (p.id !== presetId) return p;
            return { ...p, timers: p.timers.filter(t => t.id !== timerId) };
        }));
    };

    const handleUpdatePresetStatus = (id: string, status: 'Idle' | 'Started' | 'Ended') => {
        setPresets(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    };

    const handleUploadAttendance = async (timerId: string) => {
        if (!activePreset) return;
        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Image',
                    extensions: ['png', 'jpg', 'jpeg']
                }]
            });

            if (selected) {
                const path = Array.isArray(selected) ? selected[0] : selected;
                setPresets(prev => prev.map(p => {
                    if (p.id !== activePreset.id) return p;
                    return {
                        ...p,
                        timers: p.timers.map(t => t.id === timerId ? { ...t, attendanceSheetPath: path } : t)
                    };
                }));
            }
        } catch (err) {
            console.error('Failed to open dialog:', err);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-gray-900 dark:text-gray-100 transition-colors">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col h-[85vh] transition-colors overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Settings size={20} /> Exam Hall Presets
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* Left Sidebar - Presets List */}
                    <div className="w-1/3 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-800/50">
                        <div className="p-4 shrink-0 border-b border-gray-200 dark:border-gray-800">
                            <button
                                onClick={handleCreateNewPreset}
                                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                            >
                                <Plus size={16} /> Create Hall Preset
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {presets.map(preset => (
                                <div
                                    key={preset.id}
                                    className={`group flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${editingPresetId === preset.id ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-900 dark:text-emerald-100' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                                    onClick={() => setEditingPresetId(preset.id)}
                                >
                                    <div className="flex-1 min-w-0 pr-2">
                                        <div className="font-semibold truncate">{preset.name}</div>
                                        <div className="text-xs opacity-70 mt-0.5 pb-1">
                                            {preset.session ? `${preset.session} • ` : ''}
                                            {preset.scheduledStartTime ? `${preset.scheduledStartTime} • ` : ''}
                                            {preset.timers.length} timers
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id); }}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            {presets.length === 0 && (
                                <div className="text-center text-gray-500 dark:text-gray-400 text-sm mt-8">
                                    No hall presets yet.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Area - Preset Editor */}
                    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
                        {activePreset ? (
                            <>
                                <div className="p-6 border-b border-gray-200 dark:border-gray-800 shrink-0">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="flex-1 flex items-center gap-3">
                                            <input
                                                type="text"
                                                value={activePreset.name}
                                                onChange={(e) => handleRenamePreset(activePreset.id, e.target.value)}
                                                className="text-2xl font-bold bg-transparent border-b-2 border-transparent focus:border-emerald-500 focus:outline-none px-1 py-1 w-full text-gray-900 dark:text-white"
                                                placeholder="Hall Name (e.g., Main Auditorium)"
                                            />
                                            <Edit3 size={18} className="text-gray-400" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${activePreset.status === 'Started' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' :
                                                activePreset.status === 'Ended' ? 'bg-red-500/10 border-red-500/50 text-red-500' :
                                                    'bg-gray-500/10 border-gray-500/50 text-gray-500'
                                                }`}>
                                                {activePreset.status}
                                            </span>
                                            {activePreset.status === 'Ended' && (
                                                <button
                                                    onClick={() => handleUpdatePresetStatus(activePreset.id, 'Idle')}
                                                    className="p-1 px-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-[10px] font-bold transition-colors"
                                                >
                                                    Reset
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Session</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={activePreset.session || ''}
                                                    onChange={(e) => handleUpdatePresetField(activePreset.id, 'session', e.target.value)}
                                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-gray-900 dark:text-gray-100 transition-colors"
                                                    placeholder="e.g. Session 1"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Scheduled Time & Date</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="time"
                                                    value={activePreset.scheduledStartTime || ''}
                                                    onChange={(e) => handleUpdatePresetField(activePreset.id, 'scheduledStartTime', e.target.value)}
                                                    className="w-1/3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-gray-900 dark:text-gray-100 transition-colors"
                                                />
                                                <input
                                                    type="date"
                                                    value={activePreset.scheduledDate || ''}
                                                    onChange={(e) => handleUpdatePresetField(activePreset.id, 'scheduledDate', e.target.value)}
                                                    className="w-2/3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-gray-900 dark:text-gray-100 transition-colors"
                                                />
                                            </div>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Remark / Report</label>
                                            <input
                                                type="text"
                                                value={activePreset.remark || ''}
                                                onChange={(e) => handleUpdatePresetField(activePreset.id, 'remark', e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-gray-900 dark:text-gray-100 transition-colors"
                                                placeholder="Any structural issues or reporting notes for this hall..."
                                            />
                                        </div>
                                    </div>

                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Timers in this Hall</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <button
                                            onClick={() => setShowAddExam(true)}
                                            className="py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 text-gray-600 dark:text-gray-400 font-medium transition-colors"
                                        >
                                            + Add Exam Timer
                                        </button>
                                        <button
                                            onClick={() => setShowAddQuiz(true)}
                                            className="py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 text-gray-600 dark:text-gray-400 font-medium transition-colors"
                                        >
                                            + Add General Timer
                                        </button>
                                    </div>

                                    {activePreset.timers.map((timer) => (
                                        <div key={timer.id} className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center justify-between">
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white">
                                                    {timer.mode === 'exam' ? timer.courseCode : timer.label}
                                                </div>
                                                <div className="text-sm text-gray-500 mt-1">
                                                    Duration: {Math.floor(timer.durationSeconds / 60)} minutes
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveTimer(activePreset.id, timer.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {activePreset.timers.length === 0 && (
                                        <div className="text-center text-gray-400 py-12">
                                            No timers added to this hall yet.
                                        </div>
                                    )}

                                    {/* Attendance Section */}
                                    {activePreset.timers.some(t => t.mode === 'exam') && (
                                        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                    <ClipboardList size={18} className="text-emerald-500" />
                                                    Student Attendance Sheets
                                                </h3>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                    Required for each course
                                                </span>
                                            </div>

                                            <div className="space-y-3">
                                                {activePreset.timers.filter(t => t.mode === 'exam').map((t) => {
                                                    const timer = t as ExamTimer;
                                                    return (
                                                        <div key={timer.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${timer.attendanceSheetPath ? 'bg-emerald-50/30 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20' : 'bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700'}`}>
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-2 rounded-lg ${timer.attendanceSheetPath ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                                                                    <Image size={16} />
                                                                </div>
                                                                <div>
                                                                    <div className="text-xs font-bold text-gray-900 dark:text-white">{timer.courseCode}</div>
                                                                    <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                                                                        {timer.attendanceSheetPath ? 'Sheet attached' : 'No sheet uploaded'}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <button
                                                                onClick={() => handleUploadAttendance(timer.id)}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${timer.attendanceSheetPath
                                                                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                                            >
                                                                {timer.attendanceSheetPath ? (
                                                                    <><CheckCircle2 size={12} /> Replace</>
                                                                ) : (
                                                                    <><Upload size={12} /> Upload Sheet</>
                                                                )}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                <Settings size={48} className="mb-4 opacity-20" />
                                <p>Select a preset to edit or create a new one.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/80 flex justify-end shrink-0 gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors">
                        <Save size={18} /> Save All Changes
                    </button>
                </div>

            </div>

            {/* Modals */}
            {showAddExam && (
                <AddExamTimerModal
                    onClose={() => setShowAddExam(false)}
                    onAdd={(code, title, prog, count, duration) => handleAddExamTimer(code, title, prog, count, duration)}
                    timerCount={activePreset?.timers.length || 0}
                    savedCourses={settings.savedCourses || []}
                />
            )}
            {showAddQuiz && (
                <QuizSetupModal
                    onClose={() => setShowAddQuiz(false)}
                    onStart={(label, duration) => handleAddQuizTimer(label, duration)}
                />
            )}
        </div>
    );
}

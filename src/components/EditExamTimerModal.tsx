import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { ExamTimer } from '../lib/types';

interface EditExamTimerModalProps {
    timer: ExamTimer;
    onUpdate: (id: string, updates: { courseCode: string; program: string; studentCount: number; durationSeconds: number }) => void;
    onClose: () => void;
}

export default function EditExamTimerModal({ timer, onUpdate, onClose }: EditExamTimerModalProps) {
    const [courseCode, setCourseCode] = useState(timer.courseCode);
    const [program, setProgram] = useState(timer.program);
    const [studentCount, setStudentCount] = useState(timer.studentCount.toString());

    // Calculate initial hours and minutes from total target duration
    // Note: If you edit a timer that had 10 minutes left of a 60 min duration,
    // you edit the *total* duration. The remaining will adjust proportionally.
    const [hours, setHours] = useState(Math.floor(timer.durationSeconds / 3600));
    const [minutes, setMinutes] = useState(Math.floor((timer.durationSeconds % 3600) / 60));

    // Update state if timer prop changes (unlikely in modal but good practice)
    useEffect(() => {
        setCourseCode(timer.courseCode);
        setProgram(timer.program);
        setStudentCount(timer.studentCount.toString());
        setHours(Math.floor(timer.durationSeconds / 3600));
        setMinutes(Math.floor((timer.durationSeconds % 3600) / 60));
    }, [timer]);

    const totalSeconds = hours * 3600 + minutes * 60;
    const isValid = totalSeconds >= 60; // Minimum 1 minute duration

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;

        onUpdate(timer.id, {
            courseCode: courseCode.trim(),
            program: program.trim(),
            studentCount: parseInt(studentCount, 10) || 0,
            durationSeconds: totalSeconds
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 transition-colors">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-[460px] shadow-2xl transition-colors">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 transition-colors">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Timer</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Course Code */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 transition-colors">Course Code</label>
                        <input
                            type="text"
                            value={courseCode}
                            onChange={(e) => setCourseCode(e.target.value)}
                            placeholder="e.g. GEOM 261 (Optional)"
                            maxLength={100}
                            autoFocus
                            className="w-full px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                         text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500/50
                         focus:ring-1 focus:ring-blue-500/20 transition-colors"
                        />
                    </div>

                    {/* Program / Cohort */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 transition-colors">Program / Cohort</label>
                        <input
                            type="text"
                            value={program}
                            onChange={(e) => setProgram(e.target.value)}
                            placeholder="e.g. BSc Geomatic Engineering (Optional)"
                            maxLength={80}
                            className="w-full px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                         text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500/50
                         focus:ring-1 focus:ring-blue-500/20 transition-colors"
                        />
                    </div>

                    {/* Student Count */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 transition-colors">Number of Students</label>
                        <input
                            type="number"
                            min={0}
                            max={999}
                            value={studentCount}
                            onChange={(e) => setStudentCount(e.target.value)}
                            placeholder="e.g. 45 (Optional)"
                            className="w-32 px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                         text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500/50
                         focus:ring-1 focus:ring-blue-500/20 transition-colors"
                        />
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 transition-colors">Total Duration</label>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={0}
                                    max={9}
                                    value={hours}
                                    onChange={(e) => setHours(Math.min(9, Math.max(0, Number(e.target.value))))}
                                    className="w-20 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                             text-gray-900 dark:text-white text-center text-lg font-mono focus:outline-none 
                             focus:border-blue-500/50 transition-colors"
                                />
                                <span className="text-gray-500 dark:text-gray-400 text-sm transition-colors">hours</span>
                            </div>
                            <span className="text-gray-400 dark:text-gray-600 text-2xl font-light transition-colors">:</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={0}
                                    max={59}
                                    value={minutes}
                                    onChange={(e) => setMinutes(Math.min(59, Math.max(0, Number(e.target.value))))}
                                    className="w-20 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                             text-gray-900 dark:text-white text-center text-lg font-mono focus:outline-none 
                             focus:border-blue-500/50 transition-colors"
                                />
                                <span className="text-gray-500 dark:text-gray-400 text-sm transition-colors">minutes</span>
                            </div>
                        </div>
                        <p className="text-xs text-amber-600 dark:text-amber-500/80 mt-2 transition-colors">
                            Warning: Trimming the duration will immediately reduce the remaining time proportionately.
                        </p>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={!isValid}
                        className="w-full py-3 mt-4 rounded-xl bg-blue-600 dark:bg-blue-600 text-white font-bold text-lg
                       hover:bg-blue-500 dark:hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors shadow-lg shadow-blue-600/20"
                    >
                        Save Changes
                    </button>
                </form>
            </div>
        </div>
    );
}

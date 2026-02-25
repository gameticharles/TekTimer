import { useState } from 'react';
import { X } from 'lucide-react';

interface AddExamTimerModalProps {
    onAdd: (courseCode: string, program: string, studentCount: number, durationSeconds: number) => void;
    onClose: () => void;
    timerCount: number;
}

export default function AddExamTimerModal({ onAdd, onClose, timerCount }: AddExamTimerModalProps) {
    const [courseCode, setCourseCode] = useState('');
    const [program, setProgram] = useState('');
    const [studentCount, setStudentCount] = useState('');
    const [hours, setHours] = useState(2);
    const [minutes, setMinutes] = useState(0);

    const totalSeconds = hours * 3600 + minutes * 60;
    const isValid = totalSeconds >= 60;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;
        onAdd(courseCode.trim(), program.trim(), parseInt(studentCount, 10) || 0, totalSeconds);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-[460px] shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                    <h2 className="text-xl font-bold text-white">Add Exam Timer</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Course Code */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Course Code</label>
                        <input
                            type="text"
                            value={courseCode}
                            onChange={(e) => setCourseCode(e.target.value)}
                            placeholder="e.g. GEOM 261 (Optional)"
                            maxLength={20}
                            autoFocus
                            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 
                         text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50
                         focus:ring-1 focus:ring-blue-500/20 transition-colors"
                        />
                    </div>

                    {/* Program / Cohort */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Program / Cohort</label>
                        <input
                            type="text"
                            value={program}
                            onChange={(e) => setProgram(e.target.value)}
                            placeholder="e.g. BSc Geomatic Engineering (Optional)"
                            maxLength={80}
                            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 
                         text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50
                         focus:ring-1 focus:ring-blue-500/20 transition-colors"
                        />
                    </div>

                    {/* Student Count */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Number of Students</label>
                        <input
                            type="number"
                            min={0}
                            max={999}
                            value={studentCount}
                            onChange={(e) => setStudentCount(e.target.value)}
                            placeholder="e.g. 45 (Optional)"
                            className="w-32 px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 
                         text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50
                         focus:ring-1 focus:ring-blue-500/20 transition-colors"
                        />
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Duration</label>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={0}
                                    max={9}
                                    value={hours}
                                    onChange={(e) => setHours(Math.min(9, Math.max(0, Number(e.target.value))))}
                                    className="w-20 px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 
                             text-white text-center text-lg font-mono focus:outline-none 
                             focus:border-blue-500/50 transition-colors"
                                />
                                <span className="text-gray-400 text-sm">hours</span>
                            </div>
                            <span className="text-gray-600 text-2xl font-light">:</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={0}
                                    max={59}
                                    value={minutes}
                                    onChange={(e) => setMinutes(Math.min(59, Math.max(0, Number(e.target.value))))}
                                    className="w-20 px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 
                             text-white text-center text-lg font-mono focus:outline-none 
                             focus:border-blue-500/50 transition-colors"
                                />
                                <span className="text-gray-400 text-sm">minutes</span>
                            </div>
                        </div>
                    </div>

                    {/* Counter */}
                    <p className="text-xs text-gray-500">
                        {timerCount}/5 sessions active
                    </p>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={!isValid}
                        className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-lg
                       hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors shadow-lg shadow-blue-600/20"
                    >
                        Add Timer
                    </button>
                </form>
            </div>
        </div>
    );
}

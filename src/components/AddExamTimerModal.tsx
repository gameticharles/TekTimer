import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Search, BookOpen, Users, Clock, GraduationCap } from 'lucide-react';
import type { Course } from '../lib/types';

interface AddExamTimerModalProps {
    onAdd: (courseCode: string, courseTitle: string | undefined, program: string, studentCount: number, durationSeconds: number) => void;
    onClose: () => void;
    timerCount: number;
    savedCourses: Course[];
}

export default function AddExamTimerModal({ onAdd, onClose, timerCount, savedCourses }: AddExamTimerModalProps) {
    const [courseCode, setCourseCode] = useState('');
    const [courseTitle, setCourseTitle] = useState('');
    const [program, setProgram] = useState('');
    const [studentCount, setStudentCount] = useState('');
    const [hours, setHours] = useState(1);
    const [minutes, setMinutes] = useState(0);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Auto-detect year level from course code
    const detectedLevel = useMemo(() => {
        const match = courseCode.match(/\d{3}/);
        if (match) {
            return parseInt(match[0][0]);
        }
        return null;
    }, [courseCode]);

    const suggestions = useMemo(() => {
        if (!courseCode.trim()) return [];
        const search = courseCode.toLowerCase();
        return savedCourses.filter(c =>
            c.code.toLowerCase().includes(search) ||
            c.title.toLowerCase().includes(search)
        ).slice(0, 5);
    }, [courseCode, savedCourses]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectCourse = (course: Course) => {
        setCourseCode(course.code);
        setCourseTitle(course.title);
        setProgram(course.program);
        if (course.recommendedStudentCount) {
            setStudentCount(course.recommendedStudentCount.toString());
        }
        // Duration is no longer auto-filled from Course object per request
        setShowSuggestions(false);
    };

    const totalSeconds = hours * 3600 + minutes * 60;
    const isValid = totalSeconds >= 60 && courseCode.trim().length > 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;
        onAdd(courseCode.trim(), courseTitle.trim() || undefined, program.trim(), parseInt(studentCount, 10) || 0, totalSeconds);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 transition-colors p-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-[480px] shadow-2xl transition-colors overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-gray-200 dark:border-gray-800 transition-colors shrink-0 bg-white dark:bg-gray-900">
                    <div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Add Exam Timer</h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Quickly setup a new hall session</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all group"
                    >
                        <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                    {/* Course Code with Autocomplete */}
                    <div className="relative" ref={suggestionsRef}>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-200 transition-colors flex items-center gap-2">
                                <BookOpen size={14} className="text-blue-500" />
                                Course Code / Search
                            </label>
                            {detectedLevel && (
                                <span className="text-[10px] font-black bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1 animate-in zoom-in-50 duration-300">
                                    <GraduationCap size={10} /> LEVEL {detectedLevel}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                value={courseCode}
                                onChange={(e) => {
                                    setCourseCode(e.target.value);
                                    setShowSuggestions(true);
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                placeholder="e.g. NURS 211"
                                maxLength={100}
                                autoFocus
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 
                             text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500
                             focus:ring-4 focus:ring-blue-500/10 transition-all pl-10"
                            />
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>

                        {/* Suggestions Dropdown */}
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-10 overflow-hidden py-1 border-t-4 border-t-blue-500 animate-in fade-in slide-in-from-top-2 duration-200">
                                {suggestions.map((s) => (
                                    <button
                                        key={s.code}
                                        type="button"
                                        onClick={() => handleSelectCourse(s)}
                                        className="w-full px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform inline-block">{s.code}</span>
                                                <span className="text-[9px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                    LVL {s.yearLevel}
                                                </span>
                                            </div>
                                            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">{s.program}</span>
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 truncate">{s.title}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Course Title */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-1.5 transition-colors">Course Title</label>
                        <input
                            type="text"
                            value={courseTitle}
                            onChange={(e) => setCourseTitle(e.target.value)}
                            placeholder="e.g. Human Anatomy II"
                            maxLength={150}
                            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 
                         text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500
                         focus:ring-4 focus:ring-blue-500/10 transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Program / Cohort */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-1.5 transition-colors flex items-center gap-2">
                                <Users size={14} className="text-purple-500" />
                                Program
                            </label>
                            <input
                                type="text"
                                value={program}
                                onChange={(e) => setProgram(e.target.value)}
                                placeholder="e.g. Nursing 2"
                                maxLength={80}
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 
                             text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500
                             focus:ring-4 focus:ring-blue-500/10 transition-all"
                            />
                        </div>

                        {/* Student Count */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-1.5 transition-colors">Students</label>
                            <input
                                type="number"
                                min={0}
                                max={999}
                                value={studentCount}
                                onChange={(e) => setStudentCount(e.target.value)}
                                placeholder="0"
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 
                             text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500
                             focus:ring-4 focus:ring-blue-500/10 transition-all"
                            />
                        </div>
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-2 transition-colors flex items-center gap-2">
                            <Clock size={14} className="text-orange-500" />
                            Duration
                        </label>
                        <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800/80 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                            <div className="flex-1">
                                <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1 ml-1">Hours</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={9}
                                    value={hours}
                                    onChange={(e) => setHours(Math.min(9, Math.max(0, Number(e.target.value))))}
                                    className="w-full bg-transparent text-gray-900 dark:text-white text-2xl font-mono focus:outline-none"
                                />
                            </div>
                            <div className="h-px bg-gray-100 dark:bg-gray-700 my-4 shrink-0"></div>
                            <div className="flex-1">
                                <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1 ml-1">Minutes</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={59}
                                    value={minutes}
                                    onChange={(e) => setMinutes(Math.min(59, Math.max(0, Number(e.target.value))))}
                                    className="w-full bg-transparent text-gray-900 dark:text-white text-2xl font-mono focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-2">
                        <div className="flex items-center justify-between mb-4 px-1">
                            <span className="text-xs text-gray-500 flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${timerCount >= 5 ? 'bg-red-500' : 'bg-green-500'}`} />
                                {timerCount}/5 sessions active
                            </span>
                            <span className="text-xs font-medium text-gray-400">Press Enter to add</span>
                        </div>

                        <button
                            type="submit"
                            disabled={!isValid}
                            className="w-full py-4 rounded-xl bg-blue-600 dark:bg-blue-600 text-white font-bold text-lg
                           hover:bg-blue-500 dark:hover:bg-blue-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed
                           transition-all shadow-xl shadow-blue-600/30"
                        >
                            Add Hall Session
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}



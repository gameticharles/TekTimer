import { useState, useMemo } from 'react';
import { BookOpen, Plus, Trash2, X, Edit3, Save, Search, Users, Database, GraduationCap } from 'lucide-react';
import { ask } from '@tauri-apps/plugin-dialog';
import type { Course, AppSettings } from '../lib/types';

interface Props {
    settings: AppSettings;
    onUpdate: (patch: Partial<AppSettings>) => void;
    onClose: () => void;
}

export default function CourseManager({ settings, onUpdate, onClose }: Props) {
    const [courses, setCourses] = useState<Course[]>(settings.savedCourses || []);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingCourseCode, setEditingCourseCode] = useState<string | null>(null);

    // Form state for adding/editing
    const [formData, setFormData] = useState<Course>({
        code: '',
        title: '',
        program: '',
        yearLevel: 1,
        recommendedStudentCount: 0
    });

    const filteredCourses = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return courses;
        return courses.filter(c =>
            c.code.toLowerCase().includes(query) ||
            c.title.toLowerCase().includes(query) ||
            c.program.toLowerCase().includes(query)
        );
    }, [courses, searchQuery]);

    const handleSaveAll = () => {
        onUpdate({ savedCourses: courses });
        onClose();
    };

    const handleDeleteCourse = async (course: Course) => {
        const confirmed = await ask(`Are you sure you want to delete course ${course.code}?`, {
            title: 'Confirm Deletion',
            kind: 'warning',
        });
        if (confirmed) {
            setCourses(prev => prev.filter(c => c.code !== course.code));
            if (editingCourseCode === course.code) {
                setEditingCourseCode(null);
                setFormData({ code: '', title: '', program: '', yearLevel: 1, recommendedStudentCount: 0 });
            }
        }
    };

    const handleEdit = (course: Course) => {
        setFormData(course);
        setEditingCourseCode(course.code);
    };

    const handleAddOrUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.code.trim()) return;

        const levelMatch = formData.code.match(/\d{3}/);
        const yearLevel = levelMatch ? parseInt(levelMatch[0][0]) : 1;
        const courseToSave = { ...formData, yearLevel };

        if (editingCourseCode) {
            // If we are editing, we might have changed the code itself.
            // But code is our unique identifier in this list for now.
            setCourses(prev => prev.map(c => c.code === editingCourseCode ? courseToSave : c));
        } else {
            // Add (check for duplicates)
            if (courses.some(c => c.code === formData.code)) {
                alert("Course code already exists!");
                return;
            }
            setCourses(prev => [courseToSave, ...prev]);
        }

        // Reset
        setFormData({
            code: '',
            title: '',
            program: '',
            yearLevel: 1,
            recommendedStudentCount: 0
        });
        setEditingCourseCode(null);
    };

    const isEditMode = !!editingCourseCode;

    return (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] p-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-5xl shadow-2xl transition-colors overflow-hidden flex flex-col h-[85vh]">

                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/10 rounded-2xl">
                            <Database size={28} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Curriculum Manager</h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Manage Auto-fill Database</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all text-gray-400 hover:text-gray-900 dark:hover:text-white group"
                    >
                        <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel: Course Form */}
                    <div className="w-[380px] border-r border-gray-100 dark:border-gray-800 p-6 overflow-y-auto bg-gray-50/50 dark:bg-gray-800/30">
                        <h3 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                            {isEditMode ? <Edit3 size={14} /> : <Plus size={14} />}
                            {isEditMode ? 'Edit Course' : 'Add New Course'}
                        </h3>

                        <form onSubmit={handleAddOrUpdate} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Course Code</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.code}
                                    disabled={isEditMode}
                                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="e.g. CS 101"
                                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-bold placeholder-gray-300 dark:placeholder-gray-600 disabled:opacity-50"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Course Title</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g. Intro to Computer Science"
                                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium placeholder-gray-300 dark:placeholder-gray-600"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Program / Cohort</label>
                                <input
                                    type="text"
                                    value={formData.program}
                                    onChange={e => setFormData({ ...formData, program: e.target.value })}
                                    placeholder="e.g. Computer Science 1"
                                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium placeholder-gray-300 dark:placeholder-gray-600"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Academic Level</label>
                                    <div className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-bold flex items-center gap-2">
                                        <GraduationCap size={16} className="text-blue-500" />
                                        Level {(() => {
                                            const match = formData.code.match(/\d{3}/);
                                            return match ? match[0][0] : '1';
                                        })()}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Std. Count</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={formData.recommendedStudentCount || 0}
                                        onChange={e => setFormData({ ...formData, recommendedStudentCount: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-bold"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
                                >
                                    {isEditMode ? <><Save size={18} /> Update</> : <><Plus size={18} /> Add Course</>}
                                </button>
                                {isEditMode && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingCourseCode(null);
                                            setFormData({ code: '', title: '', program: '', yearLevel: 1, recommendedStudentCount: 0 });
                                        }}
                                        className="px-6 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Right Panel: Course List */}
                    <div className="flex-1 flex flex-col p-6 bg-white dark:bg-gray-900">
                        {/* List Title & Search */}
                        <div className="flex items-center justify-between mb-6 shrink-0">
                            <h3 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <BookOpen size={14} /> Course Registry ({courses.length})
                            </h3>
                            <div className="relative w-64">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search registry..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-sm focus:ring-4 focus:ring-blue-500/5 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* List Grid */}
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                            {filteredCourses.length > 0 ? (
                                filteredCourses.map(course => (
                                    <div
                                        key={course.code}
                                        className={`group flex items-center justify-between p-4 rounded-2xl border transition-all ${editingCourseCode === course.code
                                            ? 'bg-blue-50/50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/30'
                                            : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center font-black text-xs text-blue-600 dark:text-blue-400 shadow-sm">
                                                {course.code.split(' ')[0]}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-gray-900 dark:text-white tracking-tight">{course.code}</span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-bold uppercase tracking-wider">{course.program}</span>
                                                </div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">{course.title}</div>
                                                <div className="flex items-center gap-4 mt-1">
                                                    <span className="text-[10px] text-gray-400 flex items-center gap-1"><GraduationCap size={10} /> Level {course.yearLevel}</span>
                                                    {course.recommendedStudentCount ? <span className="text-[10px] text-gray-400 flex items-center gap-1"><Users size={10} /> {course.recommendedStudentCount} stds</span> : null}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEdit(course)}
                                                className="p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-blue-500 transition-colors shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-700"
                                                title="Edit Course"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCourse(course)}
                                                className="p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-red-500 transition-colors shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-700"
                                                title="Delete Course"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                                    <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-full mb-4">
                                        <Search size={40} className="opacity-20" />
                                    </div>
                                    <p className="font-bold">No courses found matching "{searchQuery}"</p>
                                    <button onClick={() => setSearchQuery('')} className="text-blue-500 text-sm mt-2 hover:underline">Clear search</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/80 flex items-center justify-between shrink-0">
                    <div className="text-xs text-gray-500 font-medium">
                        Changes will be applied to the system registry only after you save.
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 rounded-2xl font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveAll}
                            className="px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center gap-2"
                        >
                            <Save size={18} /> Save Registry
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

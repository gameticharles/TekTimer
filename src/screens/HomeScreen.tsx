import { GraduationCap, ClipboardList, BookOpen, Settings } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { AppMode } from '../lib/types';
import UpdateChecker from '../components/UpdateChecker';

interface HomeScreenProps {
    onSelect: (mode: AppMode) => void;
    onSettings: () => void;
}

export default function HomeScreen({ onSelect, onSettings }: HomeScreenProps) {
    return (
        <div className="h-screen w-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center relative transition-colors">

            {/* Top Window Drag Region */}
            <div data-tauri-drag-region className="absolute top-0 left-0 right-0 h-12 z-0" />

            {/* Title */}
            <div className="mb-16 text-center z-10">
                <div className="flex items-center justify-center gap-4 mb-3" data-tauri-drag-region>
                    <GraduationCap size={48} className="text-amber-400" />
                    <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                        Exam & Quiz Timer
                    </h1>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                    Professional countdown timers for examinations and quizzes
                </p>
            </div>

            {/* Mode Cards */}
            <div className="flex gap-8">
                {/* Quiz Mode */}
                <button
                    onClick={() => onSelect('quiz')}
                    className="group relative w-80 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/70 
                     hover:border-amber-500/60 dark:hover:bg-gray-900 
                     transition-all duration-300 cursor-pointer text-left
                     shadow-sm dark:shadow-none hover:shadow-[0_0_40px_rgba(245,158,11,0.15)]"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                            <ClipboardList size={28} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Quiz Mode</h2>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                        Single full-screen timer for one timed activity. Maximum visibility for the entire room.
                    </p>
                    <div className="mt-6 text-amber-400 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to start →
                    </div>
                </button>

                {/* Exam Mode */}
                <button
                    onClick={() => onSelect('exam')}
                    className="group relative w-80 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/70 
                     hover:border-blue-500/60 dark:hover:bg-gray-900 
                     transition-all duration-300 cursor-pointer text-left
                     shadow-sm dark:shadow-none hover:shadow-[0_0_40px_rgba(59,130,246,0.15)]"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                            <BookOpen size={28} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Exam Mode</h2>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                        Up to 5 simultaneous timers for multi-session university examinations.
                    </p>
                    <div className="mt-6 text-blue-400 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to start →
                    </div>
                </button>
            </div>

            {/* Settings & Version */}
            <div className="absolute bottom-8 left-8 right-8 flex justify-between items-center">
                <UpdateChecker />
                <button
                    onClick={onSettings}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg
                       text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800/60 
                       transition-all duration-200"
                >
                    <Settings size={18} />
                    <span className="text-sm font-medium">Settings</span>
                </button>
            </div>

            {/* Close/minimize buttons for borderless window */}
            <div className="absolute top-4 right-4 flex gap-2">
                <button
                    onClick={() => getCurrentWindow().close()}
                    className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors"
                    aria-label="Close"
                />
            </div>
        </div>
    );
}

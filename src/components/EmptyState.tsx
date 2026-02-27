import { Plus } from 'lucide-react';

interface EmptyStateProps {
    onAddTimer: () => void;
}

export default function EmptyState({ onAddTimer }: EmptyStateProps) {
    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center">
            <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-gray-200/50 dark:bg-gray-800/50 border border-gray-300/50 dark:border-gray-700/50 
                        flex items-center justify-center mx-auto mb-6">
                    <Plus size={32} className="text-gray-400 dark:text-gray-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-400 mb-2">No Exam Timers</h2>
                <p className="text-gray-500 mb-8 max-w-sm">
                    Add up to 5 exam timers for simultaneous multi-session management.
                </p>
                <button
                    onClick={onAddTimer}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold
                     hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20 mx-auto"
                >
                    <Plus size={18} />
                    Add Exam Timer
                </button>
                <p className="text-gray-500 dark:text-gray-600 text-xs mt-4">Press N to add a timer</p>
            </div>
        </div>
    );
}

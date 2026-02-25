import { useState, useEffect } from 'react';
import { Mic, FastForward, Trash2 } from 'lucide-react';
import { announcementQueue } from '../lib/announcements';

export default function AnnouncementStatusBar() {
    const [active, setActive] = useState(false);
    const [pending, setPending] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActive(announcementQueue.isActive);
            setPending(announcementQueue.pendingCount);
        }, 500);
        return () => clearInterval(interval);
    }, []);

    if (!active && pending === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-40 bg-gray-900 border border-emerald-900/50 rounded-xl shadow-2xl overflow-hidden flex items-center animate-fade-in-up">
            <div className="pl-4 pr-3 py-2.5 flex items-center gap-2 text-emerald-400 border-r border-gray-800 bg-gray-800/50">
                <Mic size={16} className={active ? "animate-pulse" : ""} />
                <span className="text-sm font-semibold">Speaking</span>
                {pending > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-md bg-emerald-900/40 text-xs font-bold">
                        +{pending}
                    </span>
                )}
            </div>
            <div className="flex px-1">
                <button
                    onClick={() => announcementQueue.skip()}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    title="Skip current announcement"
                >
                    <FastForward size={14} />
                </button>
                <button
                    onClick={() => announcementQueue.clear()}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Clear queue"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
}

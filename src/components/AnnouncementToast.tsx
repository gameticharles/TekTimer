import { useState, useEffect } from 'react';
import { Mic } from 'lucide-react';
import { announcementQueue } from '../lib/announcements';

export default function AnnouncementToast() {
    const [text, setText] = useState<string | null>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            setText(announcementQueue.currentAnnouncementText);
        }, 200);
        return () => clearInterval(interval);
    }, []);

    if (!text) return null;

    return (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 max-w-4xl w-full px-8 pointer-events-none animate-fade-in-up">
            <div className="bg-black/85 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-5 shadow-2xl flex items-start gap-5 mx-auto w-max max-w-full">
                <Mic className="text-emerald-500 shrink-0 mt-0.5 animate-pulse" size={24} />
                <p className="text-white text-xl font-medium tracking-wide leading-relaxed text-center">
                    {text}
                </p>
            </div>
        </div>
    );
}

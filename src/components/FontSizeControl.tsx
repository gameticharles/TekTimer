import { RotateCcw } from 'lucide-react';
import { SCALE_STEP, SCALE_MIN, SCALE_MAX } from '../lib/fontSizeUtils';

interface FontSizeControlProps {
    scale: number;
    isOverride: boolean;
    onChange: (scale: number) => void;
    onReset?: () => void;
    compact?: boolean;
}

export default function FontSizeControl({
    scale,
    isOverride,
    onChange,
    onReset,
    compact = false,
}: FontSizeControlProps) {
    if (compact) {
        return (
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onChange(Math.max(SCALE_MIN, scale - SCALE_STEP))}
                    disabled={scale <= SCALE_MIN}
                    className={`px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white
                      disabled:opacity-30 disabled:cursor-not-allowed transition-all relative font-bold text-base tracking-tight
                      ${isOverride ? 'text-amber-600 dark:text-amber-400' : ''}`}
                    aria-label="Decrease font size"
                    title={`Font: ${scale}%${isOverride ? ' (override)' : ' (global)'}`}
                >
                    A−
                    {isOverride && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]" />
                    )}
                </button>
                <button
                    onClick={() => onChange(Math.min(SCALE_MAX, scale + SCALE_STEP))}
                    disabled={scale >= SCALE_MAX}
                    className={`px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white
                      disabled:opacity-30 disabled:cursor-not-allowed transition-all relative font-bold text-base tracking-tight
                      ${isOverride ? 'text-amber-600 dark:text-amber-400' : ''}`}
                    aria-label="Increase font size"
                    title={`Font: ${scale}%${isOverride ? ' (override)' : ' (global)'}`}
                >
                    A+
                    {isOverride && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]" />
                    )}
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1">
            <button
                onClick={() => onChange(Math.max(SCALE_MIN, scale - SCALE_STEP))}
                disabled={scale <= SCALE_MIN}
                className="px-2.5 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 
                   disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-bold"
            >
                A−
            </button>
            <span className="text-white font-mono text-sm min-w-[3rem] text-center">{scale}%</span>
            <button
                onClick={() => onChange(Math.min(SCALE_MAX, scale + SCALE_STEP))}
                disabled={scale >= SCALE_MAX}
                className="px-2.5 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 
                   disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-bold"
            >
                A+
            </button>
            {isOverride && onReset && (
                <button
                    onClick={onReset}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-amber-400 
                     hover:bg-gray-800 transition-colors"
                    title="Reset to global"
                >
                    <RotateCcw size={12} />
                    Reset
                </button>
            )}
        </div>
    );
}

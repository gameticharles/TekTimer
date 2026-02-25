import { Minus, Plus, RotateCcw } from 'lucide-react';
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
                    className={`p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 
                      disabled:opacity-30 disabled:cursor-not-allowed transition-all relative
                      ${isOverride ? 'text-amber-400' : ''}`}
                    aria-label="Decrease font size"
                    title={`Font: ${scale}%${isOverride ? ' (override)' : ' (global)'}`}
                >
                    <Minus size={14} />
                    {isOverride && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                </button>
                <button
                    onClick={() => onChange(Math.min(SCALE_MAX, scale + SCALE_STEP))}
                    disabled={scale >= SCALE_MAX}
                    className={`p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 
                      disabled:opacity-30 disabled:cursor-not-allowed transition-all relative
                      ${isOverride ? 'text-amber-400' : ''}`}
                    aria-label="Increase font size"
                    title={`Font: ${scale}%${isOverride ? ' (override)' : ' (global)'}`}
                >
                    <Plus size={14} />
                    {isOverride && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
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

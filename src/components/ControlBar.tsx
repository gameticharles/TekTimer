import {
    Play, Pause, RotateCcw, Maximize, Minimize, Moon,
    Plus, Minus, Settings, ArrowLeft
} from 'lucide-react';

interface ControlBarProps {
    status: 'Idle' | 'Running' | 'Paused' | 'Ended';
    isFullscreen: boolean;
    visible: boolean;
    onStart: () => void;
    onPause: () => void;
    onReset: () => void;
    onToggleFullscreen: () => void;
    onBlackout: () => void;
    onIncreaseFontSize: () => void;
    onDecreaseFontSize: () => void;
    onSettings: () => void;
    onExit: () => void;
}

export default function ControlBar({
    status,
    isFullscreen,
    visible,
    onStart,
    onPause,
    onReset,
    onToggleFullscreen,
    onBlackout,
    onIncreaseFontSize,
    onDecreaseFontSize,
    onSettings,
    onExit,
}: ControlBarProps) {
    return (
        <div
            className={`absolute bottom-0 left-0 right-0 px-6 py-4 bg-gradient-to-t from-black/80 to-transparent
                  flex items-center justify-between transition-all duration-300
                  ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
        >
            {/* Left: Navigation */}
            <div className="flex items-center gap-2">
                <button
                    onClick={onExit}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-white 
                     hover:bg-white/10 transition-all text-sm"
                    aria-label="Back to home"
                >
                    <ArrowLeft size={16} />
                    <span>Exit</span>
                </button>
            </div>

            {/* Center: Timer Controls */}
            <div className="flex items-center gap-3">
                {/* Font Size Controls */}
                <button
                    onClick={onDecreaseFontSize}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                    aria-label="Decrease font size"
                >
                    <Minus size={16} />
                </button>
                <button
                    onClick={onIncreaseFontSize}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                    aria-label="Increase font size"
                >
                    <Plus size={16} />
                </button>

                <div className="w-px h-6 bg-gray-700 mx-1" />

                {/* Play / Pause */}
                {(status === 'Idle' || status === 'Paused') && (
                    <button
                        onClick={onStart}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white 
                       font-semibold hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/20"
                    >
                        <Play size={18} fill="currentColor" />
                        <span>{status === 'Idle' ? 'Start' : 'Resume'}</span>
                    </button>
                )}

                {status === 'Running' && (
                    <button
                        onClick={onPause}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white 
                       font-semibold hover:bg-amber-500 transition-colors shadow-lg shadow-amber-600/20"
                    >
                        <Pause size={18} />
                        <span>Pause</span>
                    </button>
                )}

                {/* Reset */}
                <button
                    onClick={onReset}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-700 text-gray-200 
                     font-medium hover:bg-gray-600 transition-colors"
                    disabled={status === 'Idle'}
                >
                    <RotateCcw size={16} />
                    <span>Reset</span>
                </button>
            </div>

            {/* Right: View Controls */}
            <div className="flex items-center gap-2">
                <button
                    onClick={onBlackout}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                    aria-label="Blackout screen"
                    title="Blackout (B)"
                >
                    <Moon size={18} />
                </button>
                <button
                    onClick={onSettings}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                    aria-label="Settings"
                >
                    <Settings size={18} />
                </button>
                <button
                    onClick={onToggleFullscreen}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                    aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                    {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
            </div>
        </div>
    );
}

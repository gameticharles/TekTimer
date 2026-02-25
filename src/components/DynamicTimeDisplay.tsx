interface DynamicTimeDisplayProps {
    seconds: number;
}

export default function DynamicTimeDisplay({ seconds }: DynamicTimeDisplayProps) {
    const s = Math.max(0, seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;

    const hhStr = String(h).padStart(2, '0');
    const mmStr = String(m).padStart(2, '0');
    const ssStr = String(sec).padStart(2, '0');

    if (h > 0) {
        return (
            <div className="flex items-baseline justify-center gap-3 md:gap-4 lg:gap-6 font-extrabold tabular-nums leading-none tracking-tight">
                <div className="flex items-baseline drop-shadow-sm">
                    <span style={{ fontSize: '1em' }}>{hhStr}</span>
                    <span style={{ fontSize: '0.35em' }} className="ml-1.5 opacity-50 font-semibold tracking-normal uppercase">h</span>
                </div>
                <div className="flex items-baseline drop-shadow-sm">
                    <span style={{ fontSize: '1em' }}>{mmStr}</span>
                    <span style={{ fontSize: '0.35em' }} className="ml-1.5 opacity-50 font-semibold tracking-normal uppercase">m</span>
                </div>
                <div className="flex items-baseline drop-shadow-sm">
                    <span style={{ fontSize: '0.65em' }}>{ssStr}</span>
                    <span style={{ fontSize: '0.25em' }} className="ml-1 opacity-50 font-semibold tracking-normal uppercase">s</span>
                </div>
            </div>
        );
    }

    // Under 1 hour
    return (
        <div className="flex items-baseline justify-center gap-4 md:gap-6 lg:gap-8 font-extrabold tabular-nums leading-none tracking-tight">
            <div className="flex items-baseline drop-shadow-sm">
                <span style={{ fontSize: '1.2em' }}>{mmStr}</span>
                <span style={{ fontSize: '0.4em' }} className="ml-2 opacity-50 font-semibold tracking-normal uppercase">m</span>
            </div>
            <div className="flex items-baseline drop-shadow-sm">
                <span style={{ fontSize: '0.9em' }}>{ssStr}</span>
                <span style={{ fontSize: '0.3em' }} className="ml-1.5 opacity-50 font-semibold tracking-normal uppercase">s</span>
            </div>
        </div>
    );
}

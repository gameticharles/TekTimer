export function formatTime(totalSeconds: number, forceHours = false): string {
    const s = Math.max(0, totalSeconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(sec).padStart(2, '0');
    return (h > 0 || forceHours)
        ? `${String(h).padStart(2, '0')}:${mm}:${ss}`
        : `${mm}:${ss}`;
}

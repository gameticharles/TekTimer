import { useState, useEffect } from 'react';
import type { TimerStatus } from '../lib/types';

export function useProjectedEndTime(status: TimerStatus, remainingSeconds: number, endTimeUnix: number | null) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (status === 'Idle' || status === 'Paused') {
            // Update every second to keep the projected time accurate
            const interval = setInterval(() => setNow(Date.now()), 1000);
            return () => clearInterval(interval);
        }
    }, [status]);

    if (status === 'Running' || status === 'Ended') {
        if (!endTimeUnix) return '';
        const d = new Date(endTimeUnix * 1000);
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } else {
        // Projected end time for Idle or Paused
        const projectedUnix = Math.floor(now / 1000) + remainingSeconds;
        const d = new Date(projectedUnix * 1000);
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
}

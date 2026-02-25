import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Auto-hides controls after a period of mouse inactivity.
 * Controls become visible again on mouse move.
 */
export function useIdleControls(timeoutMs = 3000) {
    const [visible, setVisible] = useState(true);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetTimer = useCallback(() => {
        setVisible(true);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
            setVisible(false);
        }, timeoutMs);
    }, [timeoutMs]);

    const show = useCallback(() => {
        setVisible(true);
        resetTimer();
    }, [resetTimer]);

    useEffect(() => {
        const handleMouseMove = () => show();
        const handleKeyDown = () => show();

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('keydown', handleKeyDown);

        // Start initial timer
        resetTimer();

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('keydown', handleKeyDown);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [show, resetTimer]);

    return { controlsVisible: visible, showControls: show };
}

import { useState, useCallback, useEffect } from 'react';

/**
 * Manages blackout state with keyboard shortcut support.
 */
export function useBlackout() {
    const [isBlackout, setIsBlackout] = useState(false);

    const enableBlackout = useCallback(() => setIsBlackout(true), []);
    const disableBlackout = useCallback(() => setIsBlackout(false), []);
    const toggleBlackout = useCallback(() => setIsBlackout((prev) => !prev), []);

    // Keyboard shortcut: 'B' toggles blackout
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                e.target instanceof HTMLSelectElement
            ) {
                return;
            }
            if (e.key === 'b' || e.key === 'B') {
                toggleBlackout();
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [toggleBlackout]);

    return { isBlackout, enableBlackout, disableBlackout, toggleBlackout };
}

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useFullscreen() {
    const [isFullscreen, setIsFullscreen] = useState(false);

    const enter = useCallback(async () => {
        try {
            await invoke('set_fullscreen', { fullscreen: true });
            setIsFullscreen(true);
        } catch (err) {
            console.error('Failed to enter fullscreen:', err);
        }
    }, []);

    const exit = useCallback(async () => {
        try {
            await invoke('set_fullscreen', { fullscreen: false });
            setIsFullscreen(false);
        } catch (err) {
            console.error('Failed to exit fullscreen:', err);
        }
    }, []);

    const toggle = useCallback(() => {
        return isFullscreen ? exit() : enter();
    }, [isFullscreen, enter, exit]);

    // Sync with actual fullscreen state
    useEffect(() => {
        const sync = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', sync);
        return () => document.removeEventListener('fullscreenchange', sync);
    }, []);

    return { isFullscreen, enter, exit, toggle };
}

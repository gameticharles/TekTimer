import { useState, useEffect, useCallback } from 'react';
import { load } from '@tauri-apps/plugin-store';
import type { AppSettings } from '../lib/types';
import { DEFAULT_SETTINGS } from '../lib/types';

const STORE_PATH = 'settings.json';

export function useSettings() {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const store = await load(STORE_PATH);
                const saved = await store.get<AppSettings>('settings');
                if (saved) {
                    setSettings({ ...DEFAULT_SETTINGS, ...saved });
                }
            } catch (err) {
                console.error('Failed to load settings:', err);
            }
            setLoaded(true);
        })();
    }, []);

    const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
        setSettings((prev) => {
            const next = { ...prev, ...patch };
            // Save asynchronously
            (async () => {
                try {
                    const store = await load(STORE_PATH);
                    await store.set('settings', next);
                    await store.save();
                } catch (err) {
                    console.error('Failed to save settings:', err);
                }
            })();
            return next;
        });
    }, []);

    const resetSettings = useCallback(async () => {
        setSettings(DEFAULT_SETTINGS);
        try {
            const store = await load(STORE_PATH);
            await store.set('settings', DEFAULT_SETTINGS);
            await store.save();
        } catch (err) {
            console.error('Failed to reset settings:', err);
        }
    }, []);

    return { settings, updateSettings, resetSettings, loaded };
}

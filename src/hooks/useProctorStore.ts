import { useState, useCallback, useEffect } from 'react';
import { load } from '@tauri-apps/plugin-store';
import type { ExamLogEntry } from '../lib/types';

const LOGS_STORE_PATH = 'logs.json';

export function useProctorStore() {
    const [logs, setLogs] = useState<ExamLogEntry[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load logs on mount
    useEffect(() => {
        (async () => {
            try {
                const store = await load(LOGS_STORE_PATH);
                const saved = await store.get<ExamLogEntry[]>('logs');
                if (saved && Array.isArray(saved)) {
                    setLogs(saved);
                }
            } catch (err) {
                console.error('Failed to load logs:', err);
            } finally {
                setIsLoaded(true);
            }
        })();
    }, []);

    // Save logs on change
    useEffect(() => {
        if (!isLoaded) return;
        const timeoutId = setTimeout(async () => {
            try {
                const store = await load(LOGS_STORE_PATH);
                await store.set('logs', logs);
                await store.save();
            } catch (err) {
                console.error('Failed to save logs:', err);
            }
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [logs, isLoaded]);

    const addLog = useCallback((type: ExamLogEntry['type'], message: string, itemIdentifier?: string, timerId?: string, groupId?: string) => {
        setLogs(prev => [
            {
                id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                timestamp: Date.now(),
                type,
                message,
                itemIdentifier,
                timerId,
                groupId
            },
            ...prev
        ].slice(0, 1000)); // KEEP last 1000 logs
    }, []);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    return {
        logs,
        addLog,
        clearLogs
    };
}

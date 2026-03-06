import { useState, useCallback } from 'react';
import type { ExamLogEntry } from '../lib/types';

export function useProctorStore() {
    const [logs, setLogs] = useState<ExamLogEntry[]>([]);

    const addLog = useCallback((type: ExamLogEntry['type'], message: string, timerId?: string, groupId?: string) => {
        setLogs(prev => [
            {
                id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                timestamp: Date.now(),
                type,
                message,
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

import { useState, useMemo, useEffect } from 'react';
import { Play, Pause, Settings, MoreVertical, CheckCircle2, AlertTriangle, XCircle, Clock, Search, FolderPlus, RotateCcw, Trash2, BookOpen, ClipboardList, X, Database } from 'lucide-react';
import { ask } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getVersion } from '@tauri-apps/api/app';
import type { AppSettings, AnyTimer, TimerPreset, ExamLogEntry, ExamTimer } from '../lib/types';
import type { TimerStore } from '../hooks/useTimerStore';
import { useProctorStore } from '../hooks/useProctorStore';
import PresetManager from '../components/PresetManager';
import CourseManager from '../components/CourseManager';

interface Props {
    settings: AppSettings;
    onUpdateSettings: (patch: Partial<AppSettings>) => void;
    onSettings: () => void;
    onOpenGroup: (groupId: string) => void;
    onOpenExam: () => void;
    onOpenQuiz: () => void;
    onOpenQuizTimer: (timerId: string) => void;
    store: TimerStore;
    logs: ExamLogEntry[];
    onClearLogs: () => void;
}

export default function ProctorDashboard({ settings, onUpdateSettings, onSettings, onOpenGroup, onOpenExam, onOpenQuiz, onOpenQuizTimer, store, logs, onClearLogs }: Props) {
    const { timers, createGroupFromPreset, startGroup, pauseGroup, addExtraTimeGroup, removeGroup, startTimer, pauseTimer, resetTimer, addExtraTime, deleteTimer } = store;
    const { addLog } = useProctorStore(); // Keep addLog for some local UI events if needed, but we'll use it less

    const [showPresets, setShowPresets] = useState(false);
    const [showCourses, setShowCourses] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showPresetSelection, setShowPresetSelection] = useState(false);
    const [appVersion, setAppVersion] = useState<string>('');

    useEffect(() => {
        getVersion().then(setAppVersion);
    }, []);

    const handleExit = async () => {
        const confirmed = await ask("Are you sure you want to exit the application?", {
            title: "Exit Confirmation",
            kind: "warning"
        });
        if (confirmed) {
            await getCurrentWindow().close();
        }
    };


    const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
    const [notifiedGroups, setNotifiedGroups] = useState<Set<string>>(new Set());

    // Close dropdown on outside click
    useEffect(() => {
        if (!activeDropdownId) return;
        const hc = () => setActiveDropdownId(null);
        window.addEventListener('click', hc);
        return () => window.removeEventListener('click', hc);
    }, [activeDropdownId]);

    // Group timers by groupId
    const groups = useMemo(() => {
        const map = new Map<string, AnyTimer[]>();
        timers.forEach(t => {
            if (t.groupId) {
                if (!map.has(t.groupId)) map.set(t.groupId, []);
                map.get(t.groupId)!.push(t);
            }
        });

        // We also need the group names from presets... Wait, we didn't store group names in the timer objects.
        // Let's resolve the group name by looking at the first timer's groupId, but where is the name?
        // Let's map groupId -> Hall Name. If we lost the name, we can just use "Hall" or maybe we need to store the name.
        // Actually, we can just infer the name, or for now, say "Active Hall".

        const activeGroups: {
            id: string,
            name: string,
            session?: string,
            scheduledStartTime?: string,
            scheduledDate?: string,
            remark?: string,
            timers: AnyTimer[],
            status: string,
            progress: number,
            mainTimer: AnyTimer | null,
            attendanceCount: number,
            totalRequiredSheets: number
        }[] = [];

        map.forEach((groupTimers, groupId) => {
            // Determine combined status
            const running = groupTimers.filter(t => t.status === 'Running').length;
            const paused = groupTimers.filter(t => t.status === 'Paused').length;
            const ended = groupTimers.filter(t => t.status === 'Ended').length;

            let status = 'SCHEDULED';
            if (running > 0) status = 'RUNNING';
            else if (ended === groupTimers.length) status = 'ENDED';
            else if (paused > 0) status = 'PAUSED';

            // Check warning
            const inWarning = groupTimers.some(t => t.remainingSeconds <= settings.warningThresholdSeconds && t.remainingSeconds > 0 && t.status !== 'Ended');
            if (running > 0 && inWarning) status = 'WARNING';

            // Progress
            const totalDuration = groupTimers.reduce((acc, t) => acc + t.durationSeconds, 0);
            const totalRemaining = groupTimers.reduce((acc, t) => acc + t.remainingSeconds, 0);
            const progress = totalDuration > 0 ? ((totalDuration - totalRemaining) / totalDuration) * 100 : 0;

            const mainTimer = groupTimers.find(t => t.mode === 'exam') || groupTimers[0];

            // Attendance check
            const preset = settings.savedPresets.find(p => p.timers.some(pt =>
                groupTimers.some(gt => gt.mode === 'exam' && pt.mode === 'exam' && gt.courseCode === pt.courseCode)
            ));
            const examTimersInPreset = preset?.timers.filter(t => t.mode === 'exam') || [];
            const attendanceCount = examTimersInPreset.filter(t => t.attendanceSheetPath).length;
            const totalRequiredSheets = examTimersInPreset.length;

            activeGroups.push({
                id: groupId,
                name: mainTimer?.groupName || `Hall ${groupId.split('-')[1]?.substring(0, 4) || ''}`,
                session: mainTimer?.groupSession,
                scheduledStartTime: mainTimer?.groupStartTime,
                scheduledDate: mainTimer?.groupDate,
                remark: mainTimer?.groupRemark,
                timers: groupTimers,
                status,
                progress,
                mainTimer,
                attendanceCount,
                totalRequiredSheets
            });
        });

        // Naturally sort by Scheduled Start Time first, then fallback to ID
        return activeGroups.sort((a, b) => {
            if (a.scheduledStartTime && b.scheduledStartTime) {
                return a.scheduledStartTime.localeCompare(b.scheduledStartTime);
            }
            if (a.scheduledStartTime) return -1;
            if (b.scheduledStartTime) return 1;
            return b.id.localeCompare(a.id);
        });
    }, [timers, settings.warningThresholdSeconds]);

    // Ungrouped timers (standalone exam/quiz timers)
    const ungroupedTimers = useMemo(() => {
        return timers.filter(t => !t.groupId);
    }, [timers]);

    // Build a virtual group for ungrouped timers so they show in the monitoring table
    const ungroupedGroup = useMemo(() => {
        if (ungroupedTimers.length === 0) return null;
        const running = ungroupedTimers.filter(t => t.status === 'Running').length;
        const ended = ungroupedTimers.filter(t => t.status === 'Ended').length;
        const paused = ungroupedTimers.filter(t => t.status === 'Paused').length;
        let status = 'SCHEDULED';
        if (running > 0) status = 'RUNNING';
        else if (ended === ungroupedTimers.length) status = 'ENDED';
        else if (paused > 0) status = 'PAUSED';
        const inWarning = ungroupedTimers.some(t => t.remainingSeconds <= settings.warningThresholdSeconds && t.remainingSeconds > 0 && t.status !== 'Ended');
        if (running > 0 && inWarning) status = 'WARNING';
        const totalDuration = ungroupedTimers.reduce((acc, t) => acc + t.durationSeconds, 0);
        const totalRemaining = ungroupedTimers.reduce((acc, t) => acc + t.remainingSeconds, 0);
        const progress = totalDuration > 0 ? ((totalDuration - totalRemaining) / totalDuration) * 100 : 0;
        return {
            id: '__standalone__',
            name: 'Standalone Timers',
            timers: ungroupedTimers,
            status,
            progress,
            mainTimer: ungroupedTimers[0] || null,
            attendanceCount: 0,
            totalRequiredSheets: 0
        };
    }, [ungroupedTimers, settings.warningThresholdSeconds]);

    // Combine groups + ungrouped for display
    const allGroups = useMemo(() => {
        const result = [...groups];
        if (ungroupedGroup) result.push(ungroupedGroup);
        return result;
    }, [groups, ungroupedGroup]);

    // Track hall completion and attendance verification
    useEffect(() => {
        allGroups.forEach(group => {
            if (group.id === '__standalone__') return;

            if (group.status === 'ENDED' && !notifiedGroups.has(group.id)) {
                setNotifiedGroups(prev => new Set(prev).add(group.id));

                // Find matching preset by timers to update its status
                const preset = settings.savedPresets.find(p => p.timers.some(pt =>
                    group.timers.some(gt => gt.mode === 'exam' && pt.mode === 'exam' && gt.courseCode === pt.courseCode)
                ));

                if (preset && preset.status !== 'Ended') {
                    // 1. Move Hall State to Ended
                    const updatedPresets = settings.savedPresets.map(p =>
                        p.id === preset.id ? { ...p, status: 'Ended' as const } : p
                    );
                    onUpdateSettings({ savedPresets: updatedPresets });

                    // 2. Verify Attendance Sheets
                    const missing = preset.timers.filter(t => t.mode === 'exam' && !t.attendanceSheetPath);
                    if (missing.length > 0) {
                        const courses = missing.map(m => (m as ExamTimer).courseCode).join(', ');
                        addLog('WARNING', `Hall ${preset.name} ended with missing attendance sheets for: ${courses}`, preset.name, undefined, group.id);
                    } else {
                        addLog('INFO', `Hall ${preset.name} ended with all attendance sheets verified.`, preset.name, undefined, group.id);
                    }
                }
            }
        });
    }, [allGroups, notifiedGroups, settings.savedPresets, onUpdateSettings, addLog]);

    // Derived Metrics — count individual timers, not groups
    const metrics = useMemo(() => {
        const allTimers = allGroups.flatMap(g => g.timers);
        const running = allTimers.filter(t => t.status === 'Running').length;
        const warning = allTimers.filter(t => t.status === 'Running' && t.remainingSeconds <= settings.warningThresholdSeconds && t.remainingSeconds > 0).length;
        const ended = allTimers.filter(t => t.status === 'Ended').length;
        const idle = allTimers.filter(t => t.status === 'Idle' || t.status === 'Paused').length;
        const totalTimers = allTimers.length;
        const totalDuration = allTimers.reduce((acc, t) => acc + t.durationSeconds, 0);
        const totalRemaining = allTimers.reduce((acc, t) => acc + t.remainingSeconds, 0);
        const avgProgress = totalDuration > 0 ? ((totalDuration - totalRemaining) / totalDuration) * 100 : 0;
        const totalStudents = allTimers.reduce((acc, t) => acc + (t.mode === 'exam' ? t.studentCount : 0), 0);
        return { running, warning, ended, scheduled: idle, totalTimers, avgProgress, totalStudents };
    }, [allGroups, settings.warningThresholdSeconds]);

    const filteredGroups = allGroups.filter(g => {
        const query = searchQuery.toLowerCase();
        // Check Group-level fields
        const matchGroup =
            g.name.toLowerCase().includes(query) ||
            (g.session?.toLowerCase().includes(query)) ||
            (g.scheduledDate?.toLowerCase().includes(query)) ||
            (g.remark?.toLowerCase().includes(query));

        if (matchGroup) return true;

        // Check Individual Timer fields
        return g.timers.some(t => {
            const basicMatch = t.label.toLowerCase().includes(query);
            if (basicMatch) return true;

            if (t.mode === 'exam') {
                return (
                    t.courseCode.toLowerCase().includes(query) ||
                    (t.courseTitle?.toLowerCase().includes(query)) ||
                    t.program.toLowerCase().includes(query) ||
                    t.studentCount.toString().includes(query)
                );
            }
            return false;
        });
    });

    const handleStartPreset = async (preset: TimerPreset) => {
        const groupId = await createGroupFromPreset(preset, false);

        // Update preset status in settings
        const updatedPresets = settings.savedPresets.map(p =>
            p.id === preset.id ? { ...p, status: 'Started' as const } : p
        );
        onUpdateSettings({ savedPresets: updatedPresets });

        addLog('SYSTEM', `Administrator loaded preset ${preset.name}`, preset.name, undefined, groupId);
        setShowPresetSelection(false);
    };

    const formatTime = (seconds: number) => {
        if (seconds <= 0) return '00:00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const config: Record<string, string> = {
            'RUNNING': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
            'WARNING': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
            'ENDED': 'bg-red-500/10 text-red-500 border-red-500/20',
            'SCHEDULED': 'bg-gray-500/10 text-gray-500 border-gray-500/20',
            'PAUSED': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
        };
        const colorClass = config[status] || config['SCHEDULED'];

        return (
            <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${colorClass}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                {status}
            </div>
        );
    };

    return (
        <div className="h-screen w-screen bg-gray-50 dark:bg-[#111827] text-gray-900 dark:text-white flex flex-col font-sans overflow-hidden transition-colors">
            {/* Top Navigation Bar */}
            <div data-tauri-drag-region className="h-16 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1F2937] flex items-center justify-between px-6 shrink-0 transition-colors">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <img src="/icon.png" alt="Proctor App Icon" className="w-12 h-12 object-contain" />
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">Exam & Quiz Dashboard</h1>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold tracking-widest uppercase">Tek Timer Administrator View</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-8">
                    <div className="text-right flex flex-col items-center">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold">Avg. Progress</span>
                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{metrics.avgProgress.toFixed(1)}%</span>
                    </div>
                    <div className="text-right flex flex-col items-center">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold">Active</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">{allGroups.length} Groups</span>
                    </div>
                    <div className="text-right flex flex-col items-center">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold">Total Students</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">{metrics.totalStudents.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-6 ml-2">
                        <button onClick={onOpenExam} className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/20 rounded-lg text-sm font-medium transition-colors" title="Start new exam session">
                            <BookOpen size={16} /> New Exam
                        </button>
                        <button onClick={onOpenQuiz} className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 border border-amber-200 dark:border-amber-500/20 rounded-lg text-sm font-medium transition-colors" title="Start a quick timer">
                            <ClipboardList size={16} /> Quick Timer
                        </button>
                        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                        <button onClick={() => setShowPresets(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white" title="Manage Presets">
                            <FolderPlus size={20} />
                        </button>
                        <button onClick={() => setShowCourses(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white" title="Manage Courses">
                            <Database size={20} />
                        </button>
                        <button onClick={onSettings} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white" title="Settings">
                            <Settings size={20} />
                        </button>
                        <button onClick={handleExit} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" title="Close Application">
                            <X size={20} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Content Area */}
                <div className="flex-1 flex flex-col p-6 overflow-y-auto">

                    {/* Metrics Top Row */}
                    <div className="grid grid-cols-4 gap-4 mb-6 shrink-0">
                        {/* Running */}
                        <div className="bg-white dark:bg-[#1F2937] border border-gray-200 dark:border-gray-700 rounded-xl p-5 relative overflow-hidden transition-colors shadow-sm dark:shadow-none">
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Running</span>
                                <CheckCircle2 size={16} className="text-emerald-500" />
                            </div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.running.toString().padStart(2, '0')}</div>
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-100 dark:bg-gray-700">
                                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(metrics.running / Math.max(1, metrics.totalTimers)) * 100}%` }}></div>
                            </div>
                        </div>

                        {/* Warning */}
                        <div className="bg-white dark:bg-[#1F2937] border border-gray-200 dark:border-gray-700 rounded-xl p-5 relative overflow-hidden transition-colors shadow-sm dark:shadow-none">
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Warning</span>
                                <AlertTriangle size={16} className="text-amber-500" />
                            </div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.warning.toString().padStart(2, '0')}</div>
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-100 dark:bg-gray-700">
                                <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${(metrics.warning / Math.max(1, metrics.totalTimers)) * 100}%` }}></div>
                            </div>
                        </div>

                        {/* Ended */}
                        <div className="bg-white dark:bg-[#1F2937] border border-gray-200 dark:border-gray-700 rounded-xl p-5 relative overflow-hidden transition-colors shadow-sm dark:shadow-none">
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Ended</span>
                                <XCircle size={16} className="text-red-500" />
                            </div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.ended.toString().padStart(2, '0')}</div>
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-100 dark:bg-gray-700">
                                <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${(metrics.ended / Math.max(1, metrics.totalTimers)) * 100}%` }}></div>
                            </div>
                        </div>

                        {/* Scheduled */}
                        <div className="bg-white dark:bg-[#1F2937] border border-gray-200 dark:border-gray-700 rounded-xl p-5 relative overflow-hidden transition-colors shadow-sm dark:shadow-none">
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Scheduled</span>
                                <Clock size={16} className="text-gray-400" />
                            </div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.scheduled.toString().padStart(2, '0')}</div>
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-100 dark:bg-gray-800">
                                <div className="h-full bg-gray-400 dark:bg-gray-500 transition-all duration-500" style={{ width: `${(metrics.scheduled / Math.max(1, metrics.totalTimers)) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {/* Active Hall Monitoring List */}
                    <div className="bg-white dark:bg-[#1F2937] border border-gray-200 dark:border-gray-800 rounded-xl flex-1 flex flex-col min-h-0 shadow-sm dark:shadow-none transition-colors">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
                            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Active Monitoring</h2>

                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                                    <input
                                        type="text"
                                        placeholder="Filter halls..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="bg-gray-50 dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-blue-500 transition-colors w-64 text-gray-900 dark:text-gray-100"
                                    />
                                </div>
                                <button
                                    onClick={() => setShowPresetSelection(true)}
                                    className="px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/20 rounded-lg text-sm font-medium transition-colors"
                                >
                                    + Launch Hall
                                </button>
                            </div>
                        </div>

                        {/* Table Header */}
                        <div className="grid grid-cols-6 px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-[10px] font-bold text-gray-500 tracking-wider uppercase shrink-0">
                            <div className="col-span-1">Lecture Hall / ID</div>
                            <div className="col-span-1">Active Course</div>
                            <div className="col-span-1 text-center">Status</div>
                            <div className="col-span-1 text-center">Timer</div>
                            <div className="col-span-1 text-center">Progress</div>
                            <div className="col-span-1 text-right">Actions</div>
                        </div>

                        {/* Table Body */}
                        <div className="flex-1 overflow-y-auto">
                            {filteredGroups.map(group => (
                                <div key={group.id} className="grid grid-cols-6 px-6 py-4 border-b border-gray-100 dark:border-gray-700/50 transition-colors group items-start gap-y-4">

                                    {/* Col 1: Lecture Hall Info & Global Actions */}
                                    <div className="col-span-1 pr-4">
                                        <button
                                            onClick={() => {
                                                if (group.id === '__standalone__') {
                                                    const quizTimers = group.timers.filter(t => t.mode === 'quiz');
                                                    const examTimers = group.timers.filter(t => t.mode === 'exam');

                                                    if (quizTimers.length > 0 && examTimers.length === 0) {
                                                        if (quizTimers.length === 1) {
                                                            onOpenQuizTimer(quizTimers[0].id);
                                                        } else {
                                                            // For multiple quick timers, let user click individual ones in the table
                                                            // or go to default quiz screen
                                                            onOpenQuiz();
                                                        }
                                                    } else {
                                                        onOpenExam();
                                                    }
                                                } else {
                                                    onOpenGroup(group.id);
                                                }
                                            }}
                                            className="text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                            title="Open in Exam View"
                                        >
                                            <div className="font-bold text-sm text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{group.name} <span className="text-[9px] text-gray-400 group-hover:text-blue-400 font-normal">→ Open</span></div>
                                        </button>
                                        <div className="text-[10px] text-gray-500 mt-0.5">
                                            {group.session ? <span className="text-emerald-600 dark:text-emerald-500 font-semibold">{group.session} • </span> : null}
                                            {group.scheduledStartTime ? <span className="font-mono text-gray-700 dark:text-gray-400">{group.scheduledStartTime}{group.scheduledDate ? ` · ${group.scheduledDate}` : ''} • </span> : null}
                                            {!group.scheduledStartTime && group.scheduledDate ? <span className="font-mono text-gray-700 dark:text-gray-400">{group.scheduledDate} • </span> : null}
                                            {group.timers.length} Timers
                                            {group.totalRequiredSheets > 0 && (
                                                <span className={`ml-2 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-colors ${group.attendanceCount === group.totalRequiredSheets ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                                    Sheets: {group.attendanceCount}/{group.totalRequiredSheets}
                                                </span>
                                            )}
                                        </div>
                                        {group.remark && (
                                            <div title={group.remark} className="text-[10px] text-gray-400 mt-1 mb-2 truncate max-w-[150px] italic">
                                                ★ {group.remark}
                                            </div>
                                        )}

                                        {/* Group actions underneath name */}
                                        <div className="mt-3 flex items-center gap-1">
                                            {group.status === 'SCHEDULED' || group.status === 'PAUSED' ? (
                                                <button onClick={() => { startGroup(group.id); }} className="px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded text-[10px] font-bold uppercase transition-colors" title="Start All">
                                                    Start All
                                                </button>
                                            ) : (group.status === 'RUNNING' || group.status === 'WARNING') && (
                                                <button onClick={() => { pauseGroup(group.id); }} className="px-2 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded text-[10px] font-bold uppercase transition-colors" title="Pause All">
                                                    Pause All
                                                </button>
                                            )}

                                            <div className="relative">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveDropdownId(activeDropdownId === group.id ? null : group.id);
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded transition-colors"
                                                >
                                                    <MoreVertical size={14} />
                                                </button>
                                                {/* Dropdown Menu */}
                                                {activeDropdownId === group.id && (
                                                    <div className="absolute left-0 top-8 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 py-1 overflow-hidden" onClick={e => e.stopPropagation()}>
                                                        {(group.status === 'SCHEDULED' || group.status === 'PAUSED') && (
                                                            <button onClick={() => { startGroup(group.id); setActiveDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2">
                                                                <Play size={14} className="text-emerald-500" /> Start All Timers
                                                            </button>
                                                        )}
                                                        {(group.status === 'RUNNING' || group.status === 'WARNING') && (
                                                            <button onClick={() => { pauseGroup(group.id); setActiveDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2">
                                                                <Pause size={14} className="text-amber-500" /> Pause All Timers
                                                            </button>
                                                        )}
                                                        <button onClick={() => { addExtraTimeGroup(group.id, 300); setActiveDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2">
                                                            <Clock size={14} className="text-blue-500" /> Add 5 Minutes
                                                        </button>
                                                        <div className="h-px w-full bg-gray-200 dark:bg-gray-700 my-1"></div>
                                                        <button onClick={async (e) => {
                                                            e.stopPropagation();
                                                            const confirmed = await ask(`Are you sure you want to remove ${group.name}?`, {
                                                                title: 'Confirm Removal',
                                                                kind: 'warning',
                                                            });
                                                            if (confirmed) {
                                                                removeGroup(group.id);
                                                                setActiveDropdownId(null);
                                                            }
                                                        }} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 font-medium">
                                                            <Trash2 size={14} /> Remove Hall
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Col 2-6: Timers Container */}
                                    <div className="col-span-5 flex flex-col gap-3">
                                        {group.timers.map((timer, index) => {
                                            const rawProgress = timer.durationSeconds > 0 ? ((timer.durationSeconds - timer.remainingSeconds) / timer.durationSeconds) * 100 : 0;
                                            const timerProgress = Math.min(100, Math.max(0, rawProgress));

                                            return (
                                                <div key={timer.id} className={`grid grid-cols-5 items-center gap-x-2 ${index !== group.timers.length - 1 ? 'border-b border-gray-100 dark:border-gray-700/30 pb-3' : ''}`}>

                                                    {/* Course Info */}
                                                    <div className="col-span-1">
                                                        {timer.mode === 'quiz' ? (
                                                            <button
                                                                onClick={() => onOpenQuizTimer(timer.id)}
                                                                className="text-left hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                                                                title="Open in Quick Timer view"
                                                            >
                                                                <div className="font-bold text-xs text-gray-700 dark:text-gray-200 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                                                                    {timer.label} <span className="text-[9px] text-amber-400 font-normal">→ Open</span>
                                                                </div>
                                                            </button>
                                                        ) : (
                                                            <div className="font-bold text-xs text-gray-700 dark:text-gray-200">
                                                                {timer.mode === 'exam' ? timer.courseCode : (timer as AnyTimer).label}
                                                            </div>
                                                        )}
                                                        <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                                                            {timer.mode === 'exam'
                                                                ? `${timer.studentCount} Students • ${timer.program}`
                                                                : timer.mode === 'quiz' ? 'Quick Timer' : 'General Timer'}
                                                        </div>
                                                    </div>

                                                    {/* Status Badge */}
                                                    <div className="col-span-1 flex justify-center">
                                                        {timer.status === 'Idle' ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 uppercase tracking-wider">
                                                                IDLE
                                                            </span>
                                                        ) : timer.status === 'Ended' ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 uppercase tracking-wider">
                                                                ENDED
                                                            </span>
                                                        ) : (
                                                            <StatusBadge status={timer.status === 'Running' && timer.remainingSeconds > 0 && timer.remainingSeconds <= settings.warningThresholdSeconds ? 'WARNING' : timer.status.toUpperCase() as any} />
                                                        )}
                                                    </div>

                                                    {/* Timer */}
                                                    <div className="col-span-1 text-center">
                                                        <div className={`font-mono font-bold text-lg tracking-wider ${timer.status === 'Running' && timer.remainingSeconds > 0 && timer.remainingSeconds <= settings.warningThresholdSeconds ? 'text-amber-500' : timer.status === 'Ended' ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}`}>
                                                            {formatTime(timer.remainingSeconds)}
                                                        </div>
                                                    </div>

                                                    {/* Progress */}
                                                    <div className="col-span-1 flex items-center justify-center gap-2">
                                                        <div className="w-full max-w-[80px] h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${timer.status === 'Running' && timer.remainingSeconds > 0 && timer.remainingSeconds <= settings.warningThresholdSeconds ? 'bg-amber-500' : timer.status === 'Ended' ? 'bg-red-500' : 'bg-blue-500'}`}
                                                                style={{ width: `${timerProgress}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold w-6 text-right">{Math.round(timerProgress)}%</span>
                                                    </div>

                                                    {/* Individual Timer Actions */}
                                                    <div className="col-span-1 flex justify-end gap-1 relative">
                                                        {timer.status === 'Idle' || timer.status === 'Paused' ? (
                                                            <button onClick={() => { startTimer(timer.id); }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 rounded transition-colors" title="Start">
                                                                <Play size={14} />
                                                            </button>
                                                        ) : timer.status === 'Running' ? (
                                                            <button onClick={() => { pauseTimer(timer.id); }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 rounded transition-colors" title="Pause">
                                                                <Pause size={14} />
                                                            </button>
                                                        ) : null}

                                                        <button
                                                            onClick={() => { resetTimer(timer.id); }}
                                                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 rounded transition-colors" title="Reset">
                                                            <RotateCcw size={14} />
                                                        </button>

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveDropdownId(activeDropdownId === timer.id ? null : timer.id);
                                                            }}
                                                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded transition-colors">
                                                            <MoreVertical size={14} />
                                                        </button>

                                                        {/* Timer Dropdown Menu */}
                                                        {activeDropdownId === timer.id && (
                                                            <div className="absolute right-0 top-8 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 py-1 overflow-hidden" onClick={e => e.stopPropagation()}>
                                                                <button onClick={() => { addExtraTime(timer.id, 300); setActiveDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2">
                                                                    <Clock size={14} className="text-blue-500" /> Add 5 Minutes
                                                                </button>
                                                                <div className="h-px w-full bg-gray-200 dark:bg-gray-700 my-1"></div>
                                                                <button onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    const confirmed = await ask(`Are you sure you want to delete this timer?`, {
                                                                        title: 'Confirm Deletion',
                                                                        kind: 'warning',
                                                                    });
                                                                    if (confirmed) {
                                                                        deleteTimer(timer.id);
                                                                        setActiveDropdownId(null);
                                                                    }
                                                                }} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 font-medium">
                                                                    <Trash2 size={14} /> Delete Timer
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            {filteredGroups.length === 0 && (
                                <div className="p-12 text-center text-gray-400 dark:text-gray-500 flex flex-col items-center">
                                    <Search size={32} className="mb-4 opacity-50" />
                                    <p className="text-sm mb-4">No active timers. Get started!</p>
                                    <div className="flex gap-3">
                                        <button onClick={() => setShowPresetSelection(true)} className="px-4 py-2 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg text-sm font-medium transition-colors">
                                            Launch Hall Preset
                                        </button>
                                        <button onClick={onOpenExam} className="px-4 py-2 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg text-sm font-medium transition-colors">
                                            New Exam Session
                                        </button>
                                        <button onClick={onOpenQuiz} className="px-4 py-2 text-amber-500 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg text-sm font-medium transition-colors">
                                            Quick Timer
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Sidebar - Exam Log / Audit Trail */}
                <div className="w-80 bg-white dark:bg-[#1F2937] border-l border-gray-200 dark:border-gray-800 flex flex-col shrink-0 transition-colors">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>Exam Log</span>
                            <span className="px-1.5 py-0.5 rounded text-[8px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 uppercase tracking-widest font-bold border border-blue-100 dark:border-blue-500/20">Live</span>
                        </h3>
                        <button
                            onClick={onClearLogs}
                            className="text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors uppercase tracking-tight"
                        >
                            Clear
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 relative">
                        {/* Timeline line */}
                        <div className="absolute left-6 top-4 bottom-4 w-px bg-gray-200 dark:bg-gray-700"></div>

                        <div className="space-y-6 relative">
                            {logs.map((log) => {
                                const relatedTimer = store.timers.find(t => t.id === log.timerId);
                                const renderDot = () => {
                                    if (log.type === 'STARTED') return <div className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-[#1F2937] shrink-0" />;
                                    if (log.type === 'PAUSED') return <div className="w-2 h-2 rounded-full bg-amber-400 ring-4 ring-white dark:ring-[#1F2937] shrink-0" />;
                                    if (log.type === 'RESET') return <div className="w-2 h-2 rounded-full bg-blue-400 ring-4 ring-white dark:ring-[#1F2937] shrink-0" />;
                                    if (log.type === 'ENDED') return <div className="w-2 h-2 rounded-full bg-red-500 ring-4 ring-white dark:ring-[#1F2937] shrink-0" />;
                                    if (log.type === 'WARNING') return <div className="w-2 h-2 rounded-full bg-amber-600 animate-pulse ring-4 ring-white dark:ring-[#1F2937] shrink-0" />;
                                    if (log.type === 'ANNOUNCEMENT') return <div className="w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-[#1F2937] shrink-0" />;
                                    if (log.type === 'SYSTEM') return <div className="w-2 h-2 rounded-full bg-gray-500 ring-4 ring-white dark:ring-[#1F2937] shrink-0" />;
                                    return <div className="w-2 h-2 rounded-full bg-gray-400 ring-4 ring-white dark:ring-[#1F2937] shrink-0" />;
                                };

                                // Use persistent identifier if available, fallback to live timer lookup
                                const identifier = log.itemIdentifier || (relatedTimer ? (relatedTimer.mode === 'exam' ? relatedTimer.courseCode : relatedTimer.label) : '');

                                return (
                                    <div key={log.id} className="flex gap-3 group animate-in fade-in slide-in-from-right-1 duration-300">
                                        <div className="pt-1.5">{renderDot()}</div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-0.5">
                                                <span className="text-[9px] text-gray-400 font-mono">
                                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </span>
                                                {identifier && (
                                                    <span className={`text-[8px] font-bold px-1 rounded uppercase tracking-tighter ${relatedTimer?.mode === 'exam' || (!relatedTimer && identifier.match(/^[A-Z]{2,4}\d{3,4}$/)) ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                                        {identifier}
                                                    </span>
                                                )}
                                            </div>
                                            <div className={`text-[11px] leading-snug ${log.type === 'ANNOUNCEMENT' ? 'text-indigo-600 dark:text-indigo-400 font-medium italic' : 'text-gray-700 dark:text-gray-300'}`}>
                                                {log.message.includes(':') ? (log.message.split(':').slice(1).join(':').trim() || log.message) : log.message}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Dummy Log if Empty */}
                            {logs.length === 0 && (
                                <div className="flex gap-4 opacity-50">
                                    <div className="pt-1"><div className="w-2.5 h-2.5 rounded-full bg-gray-400 dark:bg-gray-600 ring-4 ring-white dark:ring-[#1F2937] shrink-0" /></div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] text-gray-500 font-mono">System</span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                            Awaiting logs. Exam events will appear here.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Presets Modal */}
            {
                showPresets && (
                    <PresetManager
                        settings={settings}
                        onUpdate={onUpdateSettings}
                        onClose={() => setShowPresets(false)}
                    />
                )}

            {showCourses && (
                <CourseManager
                    settings={settings}
                    onUpdate={onUpdateSettings}
                    onClose={() => setShowCourses(false)}
                />
            )}
            {/* Sub-modal: Launch Preset Selection */}
            {
                showPresetSelection && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-colors">
                        <div className="bg-white dark:bg-[#1F2937] border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-colors">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 shrink-0">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Scheduled Hall Sessions</h3>
                                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mt-0.5">Select a preset to launch monitoring</p>
                                </div>
                                <button
                                    onClick={() => setShowPresetSelection(false)}
                                    className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-all"
                                >
                                    <XCircle size={24} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {settings.savedPresets?.length > 0 ? (() => {
                                    // Sort presets: Date (asc), then Time (asc)
                                    const sortedPresets = [...settings.savedPresets].sort((a, b) => {
                                        const dateA = a.scheduledDate || '9999-99-99';
                                        const dateB = b.scheduledDate || '9999-99-99';
                                        const dateCompare = dateA.localeCompare(dateB);
                                        if (dateCompare !== 0) return dateCompare;

                                        const timeA = a.scheduledStartTime || '23:59';
                                        const timeB = b.scheduledStartTime || '23:59';
                                        return timeA.localeCompare(timeB);
                                    });

                                    // Group by Date
                                    const groups: { [date: string]: typeof sortedPresets } = {};
                                    sortedPresets.forEach(p => {
                                        const date = p.scheduledDate || 'Unscheduled';
                                        if (!groups[date]) groups[date] = [];
                                        groups[date].push(p);
                                    });

                                    return Object.entries(groups).map(([date, presets]) => (
                                        <div key={date} className="mb-8 last:mb-0">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="h-px flex-1 bg-gray-100 dark:bg-gray-700"></div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                                                    {date === 'Unscheduled' ? 'No Scheduled Date' : new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                                                </span>
                                                <div className="h-px flex-1 bg-gray-100 dark:bg-gray-700"></div>
                                            </div>

                                            <div className="grid gap-3">
                                                {presets.map(preset => (
                                                    <button
                                                        key={preset.id}
                                                        onClick={() => handleStartPreset(preset)}
                                                        className="group w-full text-left p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-all shadow-sm hover:shadow-md"
                                                    >
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <div className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                                        {preset.name}
                                                                    </div>
                                                                    {preset.session && (
                                                                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-tight border border-emerald-100 dark:border-emerald-500/20">
                                                                            {preset.session}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                                                                    {preset.timers.length} {preset.timers.length === 1 ? 'Course' : 'Courses'} • {preset.timers.reduce((acc, t) => acc + (t.mode === 'exam' ? (t.studentCount || 0) : 0), 0)} Students
                                                                </div>
                                                                {preset.remark && (
                                                                    <div className="text-[10px] text-gray-400 mt-2 italic truncate max-w-[280px]">
                                                                        ★ {preset.remark}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="shrink-0 text-right">
                                                                <div className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400">
                                                                    {preset.scheduledStartTime || 'No Time'}
                                                                </div>
                                                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mt-1">Scheduled Time</div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ));
                                })() : (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
                                            <XCircle size={32} className="text-gray-300 dark:text-gray-600" />
                                        </div>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 max-w-[240px]">
                                            No hall presets found. Create one in the Manage Presets menu.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Bottom Status Bar */}
            <div className="h-10 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1F2937] shrink-0 flex items-center justify-between px-6 text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wide uppercase transition-colors">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                        <span>System Health: <span className="text-emerald-500">Optimal</span></span>
                    </div>
                    <div className="w-px h-3 bg-gray-200 dark:bg-gray-700"></div>
                    <div>
                        <span>Version: <span className="text-gray-900 dark:text-gray-200">v{appVersion}</span></span>
                    </div>
                    <div className="w-px h-3 bg-gray-200 dark:bg-gray-700"></div>
                    <div>
                        <span>Sync Frequency: <span className="text-gray-900 dark:text-gray-200">500ms</span></span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <span className="text-[8px]">👤</span>
                        </div>
                        <span>Administrator: <span className="text-gray-900 dark:text-gray-200">Admin-Main</span></span>
                    </div>
                    <div className="w-px h-3 bg-gray-200 dark:bg-gray-700"></div>
                    <div className="flex items-center gap-1.5">
                        <Clock size={10} className="text-gray-400" />
                        <span>Last Updated: <span className="text-gray-900 dark:text-gray-200">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></span>
                    </div>
                </div>
            </div>
        </div >
    );
}

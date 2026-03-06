import { useState, useEffect } from 'react';
import QuizScreen from './screens/QuizScreen';
import ExamScreen from './screens/ExamScreen';
import ProctorDashboard from './screens/ProctorDashboard';
import SettingsPanel from './components/SettingsPanel';
import AnnouncementStatusBar from './components/AnnouncementStatusBar';
import AnnouncementToast from './components/AnnouncementToast';
import { useSettings } from './hooks/useSettings';
import { useTimerStore } from './hooks/useTimerStore';
import { useProctorStore } from './hooks/useProctorStore';
import type { AppMode } from './lib/types';

export default function App() {
  const [mode, setMode] = useState<AppMode>('proctor');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
  const { settings, updateSettings, resetSettings, loaded } = useSettings();
  const { logs, addLog, clearLogs } = useProctorStore();
  const store = useTimerStore(settings, addLog);

  useEffect(() => {
    if (!loaded) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark =
        settings.theme === 'dark' ||
        (settings.theme === 'system' && mediaQuery.matches);

      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [settings?.theme, loaded]);

  if (!loaded) {
    return (
      <div className="h-screen w-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-gray-900 dark:border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Settings Panel (overlay, accessible from any screen) */}
      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onUpdate={updateSettings}
          onReset={resetSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Mode Router */}
      {mode === 'quiz' && (
        <QuizScreen
          settings={settings}
          onUpdateSettings={updateSettings}
          store={store}
          timerId={activeTimerId ?? undefined}
          onExit={() => {
            setActiveTimerId(null);
            setMode('proctor');
          }}
          onSettings={() => setSettingsOpen(true)}
        />
      )}

      {mode === 'exam' && (
        <ExamScreen
          settings={settings}
          onUpdateSettings={updateSettings}
          store={store}
          groupId={activeGroupId ?? undefined}
          onExit={() => {
            setActiveGroupId(null);
            setMode('proctor');
          }}
          onSettings={() => setSettingsOpen(true)}
        />
      )}

      {mode === 'proctor' && (
        <ProctorDashboard
          settings={settings}
          onUpdateSettings={updateSettings}
          store={store}
          logs={logs}
          onClearLogs={clearLogs}
          onSettings={() => setSettingsOpen(true)}
          onOpenGroup={(groupId) => {
            setActiveGroupId(groupId);
            setMode('exam');
          }}
          onOpenExam={() => {
            setActiveGroupId(null);
            setMode('exam');
          }}
          onOpenQuiz={() => {
            setActiveTimerId(null);
            setMode('quiz');
          }}
          onOpenQuizTimer={(timerId) => {
            setActiveTimerId(timerId);
            setMode('quiz');
          }}
        />
      )}

      {/* Global TTS Status Bar and Subtitles */}
      {settings.announcementsEnabled && (
        <>
          <AnnouncementStatusBar />
          <AnnouncementToast />
        </>
      )}
    </>
  );
}

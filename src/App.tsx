import { useState } from 'react';
import HomeScreen from './screens/HomeScreen';
import QuizScreen from './screens/QuizScreen';
import ExamScreen from './screens/ExamScreen';
import SettingsPanel from './components/SettingsPanel';
import { useSettings } from './hooks/useSettings';
import type { AppMode } from './lib/types';

export default function App() {
  const [mode, setMode] = useState<AppMode>('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings, updateSettings, resetSettings, loaded } = useSettings();

  if (!loaded) {
    return (
      <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
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
      {mode === 'home' && (
        <HomeScreen
          onSelect={setMode}
          onSettings={() => setSettingsOpen(true)}
        />
      )}

      {mode === 'quiz' && (
        <QuizScreen
          settings={settings}
          onUpdateSettings={updateSettings}
          onExit={() => setMode('home')}
          onSettings={() => setSettingsOpen(true)}
        />
      )}

      {mode === 'exam' && (
        <ExamScreen
          settings={settings}
          onUpdateSettings={updateSettings}
          onExit={() => setMode('home')}
          onSettings={() => setSettingsOpen(true)}
        />
      )}
    </>
  );
}

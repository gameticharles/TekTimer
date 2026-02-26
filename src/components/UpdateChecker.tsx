import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';

export default function UpdateChecker() {
    const [currentVersion, setCurrentVersion] = useState<string>('');
    const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
    const [releaseUrl, setReleaseUrl] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        
        async function checkUpdate() {
            try {
                const version = await getVersion();
                if (!mounted) return;
                setCurrentVersion(version);

                // Fetch latest release from GitHub API
                const response = await fetch('https://api.github.com/repos/gameticharles/TekTimer/releases/latest');
                if (!response.ok) return;

                const data = await response.json();
                const latestTag = data.tag_name; // e.g. "v0.1.1" or "0.1.1" // or "v1.0"
                const cleanLatest = latestTag.replace(/^v/, ''); // remove leading 'v'

                // Simple version comparison assuming semver pattern
                if (cleanLatest !== version && isNewer(cleanLatest, version)) {
                    if (!mounted) return;
                    setUpdateAvailable(latestTag);
                    setReleaseUrl(data.html_url);
                }
            } catch (err) {
                console.error("Failed to check for updates:", err);
            }
        }

        checkUpdate();
        return () => { mounted = false; };
    }, []);

    // Simple robust semver parser: > 0 means v1 > v2
    const isNewer = (v1: string, v2: string) => {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 > p2) return true;
            if (p1 < p2) return false;
        }
        return false;
    };

    if (!updateAvailable) {
        return (
            <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-sm opacity-60">
                <span className="font-mono">v{currentVersion || '...'}</span>
            </div>
        );
    }

    return (
        <a 
            href={releaseUrl!} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full border border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors shadow-sm"
            title="A new version of TekTimer is available!"
        >
            <Download size={16} />
            <span className="text-sm font-semibold tracking-wide">Update Available: {updateAvailable}</span>
        </a>
    );
}

import type { AppSettings } from '../types';
import { TTSProvider } from './types';
import { WebSpeechTTSProvider } from './WebSpeechTTSProvider';
import { CustomTTSProvider } from './providers/CustomTTSProvider';

export function getTTSProvider(settings: AppSettings): TTSProvider {
    switch (settings.ttsProvider) {
        case 'custom-api':
            if (settings.customTTSUrl) {
                return new CustomTTSProvider(settings);
            }
            console.warn('Custom API selected but no URL configured. Falling back to Web Speech.');
            return new WebSpeechTTSProvider();

        case 'web-speech':
        default:
            return new WebSpeechTTSProvider();
    }
}

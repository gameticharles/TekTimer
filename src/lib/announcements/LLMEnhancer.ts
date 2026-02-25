import type { AppSettings } from '../types';

const SYSTEM_PROMPT = `You are an exam hall announcement assistant.
Your job is to rewrite a formal exam announcement to sound natural and clear when spoken aloud.
Rules:
- Keep the same core information (program name, time remaining)
- Use a calm, clear, authoritative tone
- Vary phrasing slightly from previous announcements so it doesn't sound like a recording
- Never add information that wasn't in the original
- Return ONLY the spoken announcement text — no quotes, no explanation
- Keep it under 25 words`;

export async function enhanceWithLLM(
    rawText: string,
    settings: AppSettings
): Promise<string> {
    if (!settings.llmEnabled || settings.llmProvider !== 'ollama' || !settings.ollamaUrl) {
        return rawText;
    }

    try {
        const response = await fetch(`${settings.ollamaUrl.replace(/\/+$/, '')}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: settings.llmModel || 'llama3.1',
                stream: false,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: rawText }
                ]
            }),
        });

        if (!response.ok) return rawText;

        const data = await response.json();
        return data.message?.content?.trim() || rawText;
    } catch (error) {
        console.warn("LLMEnhancer failed", error);
        return rawText;
    }
}

import { AnyTimer, ExamTimer } from '../types';

const NUMBER_WORDS: Record<number, string> = {
    1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
    6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
    15: 'fifteen', 20: 'twenty', 30: 'thirty', 45: 'forty-five',
    60: 'sixty',
};

export function resolveTemplate(
    template: string,
    timer: AnyTimer
): string {
    const remainingMins = Math.floor(timer.remainingSeconds / 60);
    const elapsedSecs = timer.durationSeconds - timer.remainingSeconds;
    const elapsedMins = Math.floor(elapsedSecs / 60);

    const vars: Record<string, string> = {
        program: (timer as ExamTimer).program ?? timer.label ?? '',
        courseCode: (timer as ExamTimer).courseCode ?? '',
        label: timer.label ?? '',
        remainingMinutes: String(remainingMins),
        remainingSeconds: String(timer.remainingSeconds),
        remainingWords: NUMBER_WORDS[remainingMins] ?? `${remainingMins} minutes`,
        elapsedMinutes: String(elapsedMins),
        totalMinutes: String(Math.floor(timer.durationSeconds / 60)),
        studentCount: String((timer as ExamTimer).studentCount ?? ''),
    };

    return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}

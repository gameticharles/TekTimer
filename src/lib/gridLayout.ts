export function getGridClass(count: number): string {
    const base = 'grid h-screen w-screen';
    switch (count) {
        case 1: return `${base} grid-cols-1 grid-rows-1`;
        case 2: return `${base} grid-cols-2 grid-rows-1`;
        case 3:
        case 4: return `${base} grid-cols-2 grid-rows-2`;
        case 5: return `${base} grid-cols-3 grid-rows-2`;
        default: return `${base} grid-cols-2 grid-rows-2`;
    }
}

export function getCardSpanClass(index: number, count: number): string {
    return (count === 3 && index === 0) ? 'col-span-2' : '';
}

export function getBaseClampKey(count: number): string {
    if (count === 1) return 'exam_1';
    if (count === 2) return 'exam_2';
    if (count <= 4) return 'exam_3_4';
    return 'exam_5';
}

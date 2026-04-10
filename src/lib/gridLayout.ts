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


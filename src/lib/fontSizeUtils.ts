// Base sizes per layout context (before scaling)
export const BASE_FONT_CLAMPS: Record<string, string> = {
    quiz: 'clamp(8rem, 25vw, 22rem)',
    exam_1: 'clamp(6rem, 20vw, 18rem)',
    exam_2: 'clamp(4rem, 12vw, 12rem)',
    exam_3_4: 'clamp(3rem, 9vw, 9rem)',
    exam_5: 'clamp(2rem, 7vw, 7rem)',
};

// Scale steps for the +/- buttons
export const SCALE_STEP = 10;   // Each click = ±10%
export const SCALE_MIN = 50;
export const SCALE_MAX = 200;

/**
 * Returns the effective scale for a timer.
 * Per-timer override takes precedence over global scale.
 */
export function getEffectiveScale(
    globalScale: number,
    perTimerOverride: number | null,
): number {
    return perTimerOverride ?? globalScale;
}

/**
 * Given a clamp() expression and a scale percentage, returns
 * a CSS calc() expression that applies the scale factor.
 */
export function scaleClamp(clampExpr: string, scalePct: number): string {
    const factor = scalePct / 100;
    if (factor === 1) return clampExpr;
    return clampExpr.replace(
        /clamp\(([^,]+),\s*([^,]+),\s*([^)]+)\)/,
        (_, min, preferred, max) =>
            `clamp(calc(${min.trim()} * ${factor}), calc(${preferred.trim()} * ${factor}), calc(${max.trim()} * ${factor}))`,
    );
}

/**
 * Get the base clamp expression for a given context.
 */
export function getBaseClamp(context: string): string {
    return BASE_FONT_CLAMPS[context] ?? BASE_FONT_CLAMPS.exam_3_4;
}

export const SCALE_STEP = 10;   // Each click = ±10%
export const SCALE_MIN = 50;
export const SCALE_MAX = 500;

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

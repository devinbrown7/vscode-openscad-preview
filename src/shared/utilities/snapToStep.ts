/**
 * Rounds a value to the nearest step, counted from `min` (or from 0 when
 * there's no `min`), and keeps it within `min` and `max`. A `max` that isn't
 * on the step gives the last step below it. Without a step the value is only
 * clamped.
 */
export function snapToStep(
  value: number,
  step: number | undefined,
  min: number | undefined,
  max: number | undefined,
): number {
  if (step === undefined || !(step > 0)) {
    return clamp(value, min, max);
  }
  const base = min ?? 0;
  let n = Math.round((value - base) / step);
  if (max !== undefined) {
    // The small slack keeps a max that is on the step from rounding below it.
    n = Math.min(n, Math.floor((max - base) / step + 1e-9));
  }
  if (min !== undefined) n = Math.max(n, 0);
  // Drop the float noise of base + n * step, such as 0.30000000000000004.
  return Math.round((base + n * step) * 1e9) / 1e9;
}

function clamp(
  value: number,
  min: number | undefined,
  max: number | undefined,
): number {
  if (min !== undefined) value = Math.max(min, value);
  if (max !== undefined) value = Math.min(max, value);
  return value;
}

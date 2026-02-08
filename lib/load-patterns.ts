import type { LoadPatternConfig } from "./types";

/**
 * Get effective concurrency at a given time (ms since test start).
 * Used for ramp_up (increase over time) and spike (burst in the middle/end).
 */
export function getConcurrencyAt(
  pattern: LoadPatternConfig | undefined,
  timeSinceStartMs: number,
  defaultConcurrency: number
): number {
  if (!pattern || pattern.type === "fixed_concurrency" || pattern.type === "fixed_rps") {
    return defaultConcurrency;
  }

  const timeSec = timeSinceStartMs / 1000;

  if (pattern.type === "ramp_up") {
    const rampSec = pattern.rampUpSeconds ?? 10;
    if (timeSec >= rampSec) return defaultConcurrency;
    const ratio = timeSec / rampSec;
    return Math.max(1, Math.floor(defaultConcurrency * ratio));
  }

  if (pattern.type === "spike") {
    const durationSec = 0; // Caller passes effective duration; we need test duration. So we need pattern + durationSeconds.
    const spikeStart = (durationSec - (pattern.spikeDurationSeconds ?? 5));
    const spikeConc = pattern.spikeConcurrency ?? defaultConcurrency * 2;
    if (timeSec >= spikeStart && timeSec < spikeStart + (pattern.spikeDurationSeconds ?? 5)) {
      return spikeConc;
    }
    return defaultConcurrency;
  }

  return defaultConcurrency;
}

/**
 * Get delay in ms before the next request for fixed_rps pattern.
 * So that total RPS ≈ targetRps when we have `concurrency` workers.
 */
export function getDelayMs(
  pattern: LoadPatternConfig | undefined,
  concurrency: number
): number {
  if (!pattern || pattern.type !== "fixed_rps" || !pattern.targetRps || pattern.targetRps <= 0) {
    return 0;
  }
  const msBetweenRequests = 1000 / pattern.targetRps;
  return msBetweenRequests * concurrency;
}

/**
 * For spike pattern we need test duration to know when spike starts.
 * Returns concurrency at timeSinceStartMs given full test duration in seconds.
 */
export function getConcurrencyAtWithDuration(
  pattern: LoadPatternConfig | undefined,
  timeSinceStartMs: number,
  durationSeconds: number,
  defaultConcurrency: number
): number {
  if (!pattern || pattern.type === "fixed_concurrency" || pattern.type === "fixed_rps") {
    return defaultConcurrency;
  }

  const timeSec = timeSinceStartMs / 1000;

  if (pattern.type === "ramp_up") {
    const rampSec = pattern.rampUpSeconds ?? 10;
    if (timeSec >= rampSec) return defaultConcurrency;
    const ratio = timeSec / rampSec;
    return Math.max(1, Math.floor(defaultConcurrency * ratio));
  }

  if (pattern.type === "spike") {
    const spikeDur = pattern.spikeDurationSeconds ?? 5;
    const spikeStart = Math.max(0, durationSeconds - spikeDur);
    const spikeConc = pattern.spikeConcurrency ?? defaultConcurrency * 2;
    if (timeSec >= spikeStart && timeSec < spikeStart + spikeDur) {
      return spikeConc;
    }
    return defaultConcurrency;
  }

  return defaultConcurrency;
}

/**
 * Preview data for UI: array of { timeSec, concurrency } for charting load pattern.
 */
export function getPatternPreview(
  pattern: LoadPatternConfig | undefined,
  durationSeconds: number,
  defaultConcurrency: number
): { timeSec: number; concurrency: number }[] {
  const points: { timeSec: number; concurrency: number }[] = [];
  const step = Math.max(1, Math.floor(durationSeconds / 50));
  for (let t = 0; t <= durationSeconds; t += step) {
    const ms = t * 1000;
    const c = getConcurrencyAtWithDuration(pattern, ms, durationSeconds, defaultConcurrency);
    points.push({ timeSec: t, concurrency: c });
  }
  if (points[points.length - 1]?.timeSec !== durationSeconds) {
    points.push({
      timeSec: durationSeconds,
      concurrency: getConcurrencyAtWithDuration(
        pattern,
        durationSeconds * 1000,
        durationSeconds,
        defaultConcurrency
      ),
    });
  }
  return points;
}

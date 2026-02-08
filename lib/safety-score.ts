import type { LoadTestMetrics, SafetyScore } from "./types";

/**
 * Safety score (0-100): higher is safer.
 *
 * Scoring logic:
 * 1. Start at 100.
 * 2. Error rate: subtract points for each % of failed requests. We weight TIMEOUTS
 *    more than HTTP errors (timeouts indicate availability/latency issues).
 * 3. Latency: P95 is weighted higher than average latency (tail latency matters more
 *    for user experience and system health).
 * 4. Final score is clamped to [0, 100] and rounded.
 *
 * Weights:
 * - HTTP error (non-timeout) rate: 0.6 points per 1% (capped at 40).
 * - Timeout rate: 1.2 points per 1% (capped at 30) — timeouts penalized ~2x.
 * - P95 above 500ms: 3 points per 100ms excess (capped at 25) — P95 weighted higher.
 * - Avg latency above 300ms: 1 point per 100ms excess (capped at 10) — avg secondary.
 * - Low RPS (<1): fixed 5 point penalty.
 */
const HTTP_ERROR_WEIGHT = 0.6;
const HTTP_ERROR_CAP = 40;
const TIMEOUT_WEIGHT = 1.2;
const TIMEOUT_CAP = 30;
const P95_THRESHOLD_MS = 500;
const P95_PENALTY_PER_100MS = 3;
const P95_CAP = 25;
const AVG_THRESHOLD_MS = 300;
const AVG_PENALTY_PER_100MS = 1;
const AVG_CAP = 10;
const LOW_RPS_THRESHOLD = 1;
const LOW_RPS_PENALTY = 5;

export function computeSafetyScore(metrics: LoadTestMetrics): SafetyScore {
  let score = 100;
  const reasons: string[] = [];

  // HTTP errors (failed requests that were not timeouts)
  const httpErrorCount = metrics.failedRequests - metrics.timeoutCount;
  const httpErrorRate =
    metrics.totalRequests > 0
      ? (httpErrorCount / metrics.totalRequests) * 100
      : 0;
  const httpErrorPenalty = Math.min(
    httpErrorRate * HTTP_ERROR_WEIGHT,
    HTTP_ERROR_CAP
  );
  score -= httpErrorPenalty;
  if (httpErrorRate > 0) {
    reasons.push(
      `HTTP error rate ${httpErrorRate.toFixed(1)}% reduced score by ${Math.round(httpErrorPenalty)} pts.`
    );
  }

  // Timeouts (penalized more than HTTP errors)
  const timeoutPenalty = Math.min(
    metrics.timeoutRatePercentage * TIMEOUT_WEIGHT,
    TIMEOUT_CAP
  );
  score -= timeoutPenalty;
  if (metrics.timeoutRatePercentage > 0) {
    reasons.push(
      `Timeout rate ${metrics.timeoutRatePercentage.toFixed(1)}% reduced score by ${Math.round(timeoutPenalty)} pts.`
    );
  }

  // P95 latency (weighted higher than avg)
  if (metrics.p95ResponseTime > P95_THRESHOLD_MS) {
    const excessMs = metrics.p95ResponseTime - P95_THRESHOLD_MS;
    const p95Penalty = Math.min(
      (excessMs / 100) * P95_PENALTY_PER_100MS,
      P95_CAP
    );
    score -= p95Penalty;
    reasons.push(
      `High P95 (${metrics.p95ResponseTime.toFixed(0)}ms) reduced score by ${Math.round(p95Penalty)} pts.`
    );
  }

  // Avg latency (secondary weight)
  if (metrics.avgResponseTime > AVG_THRESHOLD_MS) {
    const excessMs = metrics.avgResponseTime - AVG_THRESHOLD_MS;
    const avgPenalty = Math.min(
      (excessMs / 100) * AVG_PENALTY_PER_100MS,
      AVG_CAP
    );
    score -= avgPenalty;
    reasons.push(
      `High avg latency (${metrics.avgResponseTime.toFixed(0)}ms) reduced score by ${Math.round(avgPenalty)} pts.`
    );
  }

  if (
    metrics.requestsPerSecond > 0 &&
    metrics.requestsPerSecond < LOW_RPS_THRESHOLD
  ) {
    score -= LOW_RPS_PENALTY;
    reasons.push(
      `Low throughput (${metrics.requestsPerSecond} RPS) reduced score by ${LOW_RPS_PENALTY} pts.`
    );
  }

  const finalScore = Math.max(
    0,
    Math.min(100, Math.round(score))
  );
  let label: SafetyScore["label"] = "SAFE";
  if (finalScore < 50) label = "DANGEROUS";
  else if (finalScore < 80) label = "WARNING";

  const explanation =
    reasons.length > 0
      ? reasons.join(" ")
      : "No significant issues. System within safe limits.";

  return {
    score: finalScore,
    label,
    explanation,
  };
}

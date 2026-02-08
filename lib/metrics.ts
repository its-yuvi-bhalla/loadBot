import type { RequestResult, LoadTestMetrics } from "./types";

const BUCKET_SECONDS = 1;

/**
 * Compute percentile from sorted array. p is 0-1 (e.g. 0.95 for p95).
 * Uses linear interpolation between the two nearest ranks for smooth values.
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = (sortedValues.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (index - lower) * (sortedValues[upper] - sortedValues[lower]);
}

/**
 * Compute all metrics from an array of request results.
 */
export function computeMetrics(
  results: RequestResult[],
  durationSeconds: number
): LoadTestMetrics {
  const total = results.length;
  const successful = results.filter((r) => r.success).length;
  const failed = total - successful;
  const timeoutCount = results.filter((r) => r.error === "timeout").length;
  const errorRate =
    total > 0 ? Math.round((failed / total) * 100 * 100) / 100 : 0;
  const timeoutRatePercentage =
    total > 0 ? Math.round((timeoutCount / total) * 100 * 100) / 100 : 0;
  const rps =
    durationSeconds > 0
      ? Math.round((total / durationSeconds) * 100) / 100
      : 0;

  const responseTimes = results
    .filter((r) => r.success)
    .map((r) => r.responseTimeMs);
  const sorted = [...responseTimes].sort((a, b) => a - b);

  const avgResponseTime =
    responseTimes.length > 0
      ? Math.round(
          (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 100
        ) / 100
      : 0;
  const minResponseTime = sorted.length > 0 ? sorted[0] : 0;
  const maxResponseTime = sorted.length > 0 ? sorted[sorted.length - 1] : 0;
  const p95ResponseTime =
    sorted.length > 0 ? Math.round(percentile(sorted, 0.95) * 100) / 100 : 0;
  const p99ResponseTime =
    sorted.length > 0 ? Math.round(percentile(sorted, 0.99) * 100) / 100 : 0;

  return {
    totalRequests: total,
    successfulRequests: successful,
    failedRequests: failed,
    errorRatePercentage: errorRate,
    requestsPerSecond: rps,
    avgResponseTime,
    minResponseTime,
    maxResponseTime,
    p95ResponseTime,
    p99ResponseTime,
    timeoutCount,
    timeoutRatePercentage,
  };
}

/**
 * Build time-series buckets (1 second each) for charts: response time and error rate over time.
 */
export function buildTimeSeries(
  results: RequestResult[],
  startTime: number
): { time: number; responseTime: number; errorRate: number; successCount: number; failCount: number }[] {
  const bucketMap = new Map<
    number,
    { responseTimes: number[]; success: number; fail: number }
  >();

  for (const r of results) {
    const bucketIndex = Math.floor((r.timestamp - startTime) / 1000 / BUCKET_SECONDS);
    const key = bucketIndex * BUCKET_SECONDS;
    if (!bucketMap.has(key)) {
      bucketMap.set(key, { responseTimes: [], success: 0, fail: 0 });
    }
    const b = bucketMap.get(key)!;
    b.responseTimes.push(r.responseTimeMs);
    if (r.success) b.success += 1;
    else b.fail += 1;
  }

  const series: { time: number; responseTime: number; errorRate: number; successCount: number; failCount: number }[] = [];
  const sortedKeys = [...bucketMap.keys()].sort((a, b) => a - b);
  for (const key of sortedKeys) {
    const b = bucketMap.get(key)!;
    const total = b.success + b.fail;
    const avgRt =
      b.responseTimes.length > 0
        ? b.responseTimes.reduce((a, x) => a + x, 0) / b.responseTimes.length
        : 0;
    const errRate = total > 0 ? (b.fail / total) * 100 : 0;
    series.push({
      time: startTime + key * 1000,
      responseTime: Math.round(avgRt * 100) / 100,
      errorRate: Math.round(errRate * 100) / 100,
      successCount: b.success,
      failCount: b.fail,
    });
  }
  return series;
}

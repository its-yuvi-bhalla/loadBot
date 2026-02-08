import type {
  PerformanceThresholds,
  LoadTestMetrics,
  ThresholdVerdict,
  VerdictReason,
} from "./types";

/**
 * Evaluate current metrics against user-defined thresholds.
 * Returns PASS if all within limits, DEGRADED if some non-critical limits exceeded,
 * FAIL if any critical limit is violated. Critical violations should trigger auto-stop.
 */
export function evaluateThresholds(
  metrics: LoadTestMetrics,
  thresholds: PerformanceThresholds | undefined
): {
  verdict: ThresholdVerdict;
  reasons: VerdictReason[];
  firstViolationAt: number | undefined;
} {
  const reasons: VerdictReason[] = [];
  let verdict: ThresholdVerdict = "PASS";
  let firstViolationAt: number | undefined;

  if (!thresholds) {
    return { verdict: "PASS", reasons: [], firstViolationAt: undefined };
  }

  if (thresholds.maxErrorRatePercent != null) {
    if (metrics.errorRatePercentage > thresholds.maxErrorRatePercent) {
      reasons.push({
        threshold: "maxErrorRatePercent",
        message: `Error rate ${metrics.errorRatePercentage.toFixed(1)}% exceeds max ${thresholds.maxErrorRatePercent}%.`,
        actual: metrics.errorRatePercentage,
        limit: thresholds.maxErrorRatePercent,
      });
      verdict = "FAIL";
    }
  }

  if (thresholds.minSuccessRatePercent != null) {
    const successRate =
      metrics.totalRequests > 0
        ? (metrics.successfulRequests / metrics.totalRequests) * 100
        : 100;
    if (successRate < thresholds.minSuccessRatePercent) {
      reasons.push({
        threshold: "minSuccessRatePercent",
        message: `Success rate ${successRate.toFixed(1)}% is below min ${thresholds.minSuccessRatePercent}%.`,
        actual: successRate,
        limit: thresholds.minSuccessRatePercent,
      });
      verdict = "FAIL";
    }
  }

  if (thresholds.maxP95LatencyMs != null) {
    if (metrics.p95ResponseTime > thresholds.maxP95LatencyMs) {
      reasons.push({
        threshold: "maxP95LatencyMs",
        message: `P95 latency ${metrics.p95ResponseTime.toFixed(0)}ms exceeds max ${thresholds.maxP95LatencyMs}ms.`,
        actual: metrics.p95ResponseTime,
        limit: thresholds.maxP95LatencyMs,
      });
      verdict = verdict === "PASS" ? "DEGRADED" : "FAIL";
    }
  }

  if (reasons.length > 0) {
    firstViolationAt = Date.now();
  }

  return { verdict, reasons, firstViolationAt };
}

/**
 * Whether the current verdict should trigger auto-stop (critical failure).
 */
export function shouldAutoStop(verdict: ThresholdVerdict, reasons: VerdictReason[]): boolean {
  if (verdict !== "FAIL") return false;
  return reasons.some(
    (r) =>
      r.threshold === "maxErrorRatePercent" || r.threshold === "minSuccessRatePercent"
  );
}

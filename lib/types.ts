/** User-defined performance thresholds; optional. Critical violations can auto-stop the test. */
export interface PerformanceThresholds {
  maxErrorRatePercent?: number;
  maxP95LatencyMs?: number;
  minSuccessRatePercent?: number;
}

/** Final verdict from threshold evaluation: PASS, DEGRADED, or FAIL. */
export type ThresholdVerdict = "PASS" | "DEGRADED" | "FAIL";

/** Load pattern type for rate control. */
export type LoadPatternType = "fixed_concurrency" | "fixed_rps" | "ramp_up" | "spike";

export interface LoadPatternConfig {
  type: LoadPatternType;
  /** For fixed_rps: target requests per second. */
  targetRps?: number;
  /** For ramp_up: seconds to reach full concurrency. */
  rampUpSeconds?: number;
  /** For spike: concurrency during spike; spikeDurationSeconds for length. */
  spikeConcurrency?: number;
  spikeDurationSeconds?: number;
}

/**
 * Load test configuration passed when starting a test.
 */
export interface LoadTestConfig {
  targetUrl: string;
  method: "GET" | "POST";
  concurrentUsers: number;
  durationSeconds: number;
  requestTimeoutMs: number;
  /** Optional thresholds; when violated, verdict is updated and test can auto-stop. */
  thresholds?: PerformanceThresholds;
  /** Optional load pattern; default is fixed_concurrency (current behavior). */
  loadPattern?: LoadPatternConfig;
}

/**
 * Single request result (response time in ms, success flag, optional error).
 */
export interface RequestResult {
  responseTimeMs: number;
  success: boolean;
  statusCode?: number;
  error?: string;
  timestamp: number;
}

/**
 * Aggregated metrics computed from request results.
 */
export interface LoadTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRatePercentage: number;
  requestsPerSecond: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  /** Number of requests that failed due to timeout (subset of failedRequests). */
  timeoutCount: number;
  /** Percentage of total requests that were timeouts. */
  timeoutRatePercentage: number;
}

/**
 * Safety score result: 0-100 and label (SAFE | WARNING | DANGEROUS).
 */
export interface SafetyScore {
  score: number;
  label: "SAFE" | "WARNING" | "DANGEROUS";
  explanation: string;
}

/**
 * Legacy test verdict: UNSTABLE when error rate > 30%, CRITICAL when > 60%.
 * Kept for backward compatibility; threshold verdict is the primary one when thresholds are set.
 */
export type TestVerdict = "OK" | "UNSTABLE" | "CRITICAL";

/** Reason for threshold verdict (which threshold failed and how). */
export interface VerdictReason {
  threshold: keyof PerformanceThresholds;
  message: string;
  actual?: number;
  limit?: number;
}

/**
 * Stored test state: config, status, live/final metrics, results for charts.
 */
export interface LoadTestState {
  id: string;
  config: LoadTestConfig;
  status: "running" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  metrics: LoadTestMetrics;
  safetyScore?: SafetyScore;
  verdict: TestVerdict;
  /** Threshold-based verdict: PASS | DEGRADED | FAIL. */
  thresholdVerdict?: ThresholdVerdict;
  /** Human-readable reasons for the threshold verdict. */
  verdictReasons?: VerdictReason[];
  /** Timestamp (ms) of first threshold violation; undefined if none. */
  firstViolationAt?: number;
  /** Per-request results for charts (response time + error rate over time). */
  requestResults: RequestResult[];
  /** Time-series for charts: bucket index -> { responseTime, errorRate } */
  timeSeries: { time: number; responseTime: number; errorRate: number; successCount: number; failCount: number }[];
}

/** Snapshot of a completed test for history and comparison. */
export interface TestHistoryRecord {
  id: string;
  config: LoadTestConfig;
  metrics: LoadTestMetrics;
  safetyScore?: SafetyScore;
  verdict: TestVerdict;
  thresholdVerdict?: ThresholdVerdict;
  verdictReasons?: VerdictReason[];
  firstViolationAt?: number;
  startedAt: number;
  completedAt: number;
  timeSeries?: { time: number; responseTime: number; errorRate: number; successCount: number; failCount: number }[];
}

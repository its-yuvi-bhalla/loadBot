import type { LoadTestConfig, RequestResult, TestVerdict } from "./types";
import { computeMetrics, buildTimeSeries } from "./metrics";
import { computeSafetyScore } from "./safety-score";
import { getTest, setTest, updateTest } from "./store";
import { checkRateLimit, recordRequestSent } from "./safety";
import { evaluateThresholds, shouldAutoStop } from "./verdict";
import { getConcurrencyAtWithDuration, getDelayMs } from "./load-patterns";
import { addToHistory } from "./history";

function generateId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Shared ref so workers can stop when critical threshold is violated. */
interface StopRef {
  stop: boolean;
}

/**
 * Run a single HTTP request and record result. Respects global rate limit.
 */
async function runOneRequest(config: LoadTestConfig): Promise<RequestResult> {
  while (!checkRateLimit()) {
    await new Promise((r) => setTimeout(r, 20));
  }
  recordRequestSent();

  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const res = await fetch(config.targetUrl, {
      method: config.method,
      signal: controller.signal,
      headers:
        config.method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: config.method === "POST" ? JSON.stringify({}) : undefined,
    });
    clearTimeout(timeoutId);
    const elapsed = Date.now() - start;
    const success = res.status < 400;
    return {
      responseTimeMs: elapsed,
      success,
      statusCode: res.status,
      timestamp: start,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const elapsed = Date.now() - start;
    const message = err instanceof Error ? err.message : "Unknown error";
    const isTimeout =
      message.includes("abort") || message === "The operation was aborted.";
    return {
      responseTimeMs: elapsed,
      success: false,
      error: isTimeout ? "timeout" : message,
      timestamp: start,
    };
  }
}

/**
 * Single worker: runs until endTime or stopRef.stop. For ramp_up/spike, worker index
 * determines if this worker is "active" at current time (concurrency varies over time).
 */
async function worker(
  testId: string,
  config: LoadTestConfig,
  endTime: number,
  stopRef: StopRef,
  workerIndex: number
): Promise<void> {
  const startedAt = getTest(testId)!.startedAt;
  const durationSeconds = config.durationSeconds;
  const pattern = config.loadPattern;

  while (!stopRef.stop && Date.now() < endTime) {
    const timeSinceStart = Date.now() - startedAt;
    const currentConcurrency = getConcurrencyAtWithDuration(
      pattern,
      timeSinceStart,
      durationSeconds,
      config.concurrentUsers
    );
    if (workerIndex >= currentConcurrency) {
      await new Promise((r) => setTimeout(r, 100));
      continue;
    }

    const delayMs = getDelayMs(pattern, config.concurrentUsers);
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    const result = await runOneRequest(config);
    updateTest(testId, (state) => {
      state.requestResults.push(result);
      const durationSec = (Date.now() - state.startedAt) / 1000;
      state.metrics = computeMetrics(state.requestResults, durationSec);
      state.timeSeries = buildTimeSeries(state.requestResults, state.startedAt);
      state.verdict =
        state.metrics.errorRatePercentage > 60
          ? "CRITICAL"
          : state.metrics.errorRatePercentage > 30
            ? "UNSTABLE"
            : "OK";

      const thresholds = state.config.thresholds;
      const { verdict: thVerdict, reasons, firstViolationAt } = evaluateThresholds(
        state.metrics,
        thresholds
      );
      state.thresholdVerdict = thVerdict;
      state.verdictReasons = reasons;
      if (firstViolationAt && state.firstViolationAt == null) {
        state.firstViolationAt = firstViolationAt;
      }
      if (shouldAutoStop(thVerdict, reasons)) {
        stopRef.stop = true;
      }
    });
  }
}

/**
 * Start a load test: spawn workers, evaluate thresholds during run, auto-stop on critical failure.
 */
export function startLoadTest(config: LoadTestConfig): string {
  const id = generateId();
  const startedAt = Date.now();
  const stopRef: StopRef = { stop: false };

  const state = {
    id,
    config,
    status: "running" as const,
    startedAt,
    metrics: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errorRatePercentage: 0,
      requestsPerSecond: 0,
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      timeoutCount: 0,
      timeoutRatePercentage: 0,
    },
    verdict: "OK" as TestVerdict,
    requestResults: [] as RequestResult[],
    timeSeries: [] as {
      time: number;
      responseTime: number;
      errorRate: number;
      successCount: number;
      failCount: number;
    }[],
  };
  setTest(id, state);

  const endTime = startedAt + config.durationSeconds * 1000;
  const basePromises = Array.from(
    { length: config.concurrentUsers },
    (_, i) => worker(id, config, endTime, stopRef, i)
  );

  const spikePromisesRef: { current: Promise<void>[] } = { current: [] };
  let spikeStartMs = 0;
  const pattern = config.loadPattern;
  if (
    pattern?.type === "spike" &&
    pattern.spikeConcurrency != null &&
    pattern.spikeDurationSeconds != null
  ) {
    spikeStartMs = Math.max(
      0,
      (config.durationSeconds - pattern.spikeDurationSeconds) * 1000
    );
    const extra = Math.max(0, pattern.spikeConcurrency - config.concurrentUsers);
    if (extra > 0) {
      const spikeEndTime = startedAt + config.durationSeconds * 1000;
      setTimeout(() => {
        spikePromisesRef.current = Array.from({ length: extra }, (_, i) =>
          worker(id, config, spikeEndTime, stopRef, config.concurrentUsers + i)
        );
      }, spikeStartMs);
    }
  }

  const waitSpike = (): Promise<void> =>
    spikePromisesRef.current.length > 0
      ? Promise.all(spikePromisesRef.current).then(() => {})
      : Promise.resolve();

  Promise.all(basePromises)
    .then(() => {
      const elapsed = Date.now() - startedAt;
      const wait = Math.max(0, spikeStartMs - elapsed);
      return new Promise<void>((r) => setTimeout(r, wait));
    })
    .then(waitSpike)
    .then(() => {
    const s = getTest(id);
    if (s && s.status === "running") {
      s.status = "completed";
      s.completedAt = Date.now();
      const durationSeconds = (s.completedAt - s.startedAt) / 1000;
      s.metrics = computeMetrics(s.requestResults, durationSeconds);
      s.timeSeries = buildTimeSeries(s.requestResults, s.startedAt);
      s.safetyScore = computeSafetyScore(s.metrics);
      s.verdict =
        s.metrics.errorRatePercentage > 60
          ? "CRITICAL"
          : s.metrics.errorRatePercentage > 30
            ? "UNSTABLE"
            : "OK";
      const { verdict: thVerdict, reasons } = evaluateThresholds(
        s.metrics,
        s.config.thresholds
      );
      s.thresholdVerdict = thVerdict;
      s.verdictReasons = reasons;

      addToHistory({
        id: s.id,
        config: s.config,
        metrics: s.metrics,
        safetyScore: s.safetyScore,
        verdict: s.verdict,
        thresholdVerdict: s.thresholdVerdict,
        verdictReasons: s.verdictReasons,
        firstViolationAt: s.firstViolationAt,
        startedAt: s.startedAt,
        completedAt: s.completedAt!,
        timeSeries: s.timeSeries,
      });
    }
  });

  return id;
}

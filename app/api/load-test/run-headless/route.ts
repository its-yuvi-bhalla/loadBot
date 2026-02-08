import { NextRequest, NextResponse } from "next/server";
import { startLoadTest } from "@/lib/engine";
import { getTest } from "@/lib/store";
import { isUrlAllowed, getUrlBlockReason } from "@/lib/safety";
import type { LoadTestConfig, PerformanceThresholds, LoadPatternConfig } from "@/lib/types";

const POLL_MS = 500;
const MAX_WAIT_MS = 320000;

function parseThresholds(body: Record<string, unknown>): PerformanceThresholds | undefined {
  const t: PerformanceThresholds = {};
  if (typeof body.maxErrorRatePercent === "number") t.maxErrorRatePercent = body.maxErrorRatePercent;
  if (typeof body.maxP95LatencyMs === "number") t.maxP95LatencyMs = body.maxP95LatencyMs;
  if (typeof body.minSuccessRatePercent === "number") t.minSuccessRatePercent = body.minSuccessRatePercent;
  return Object.keys(t).length ? t : undefined;
}

function parseLoadPattern(body: Record<string, unknown>): LoadPatternConfig | undefined {
  const type = body.loadPatternType ?? (body.loadPattern as { type?: string })?.type;
  if (!type || typeof type !== "string") return undefined;
  const valid = ["fixed_concurrency", "fixed_rps", "ramp_up", "spike"];
  if (!valid.includes(type)) return undefined;
  const cfg: LoadPatternConfig = { type: type as LoadPatternConfig["type"] };
  if (type === "fixed_rps" && typeof body.targetRps === "number") cfg.targetRps = body.targetRps;
  if (type === "ramp_up" && typeof body.rampUpSeconds === "number") cfg.rampUpSeconds = body.rampUpSeconds;
  if (type === "spike") {
    if (typeof body.spikeConcurrency === "number") cfg.spikeConcurrency = body.spikeConcurrency;
    if (typeof body.spikeDurationSeconds === "number") cfg.spikeDurationSeconds = body.spikeDurationSeconds;
  }
  return cfg;
}

/**
 * CI/headless: start test, poll until completed, return structured result and exit code.
 * Exit: 0 = PASS, 1 = DEGRADED, 2 = FAIL.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const targetUrl = body.targetUrl?.trim();
    if (!targetUrl || typeof targetUrl !== "string") {
      return NextResponse.json({ error: "targetUrl required" }, { status: 400 });
    }
    if (!isUrlAllowed(targetUrl)) {
      return NextResponse.json(
        { error: getUrlBlockReason(targetUrl) ?? "URL not allowed" },
        { status: 400 }
      );
    }

    const config: LoadTestConfig = {
      targetUrl,
      method: body.method === "POST" ? "POST" : "GET",
      concurrentUsers: Math.max(1, Math.min(100, Number(body.concurrentUsers) || 5)),
      durationSeconds: Math.max(1, Math.min(300, Number(body.durationSeconds) || 10)),
      requestTimeoutMs: Math.max(1000, Math.min(60000, Number(body.requestTimeoutMs) || 5000)),
      thresholds: parseThresholds(body),
      loadPattern: parseLoadPattern(body),
    };

    const testId = startLoadTest(config);
    const startWait = Date.now();

    while (Date.now() - startWait < MAX_WAIT_MS) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const state = getTest(testId);
      if (!state) {
        return NextResponse.json({ error: "Test not found" }, { status: 404 });
      }
      if (state.status === "completed" || state.status === "failed") {
        const verdict = state.thresholdVerdict ?? (state.verdict === "CRITICAL" ? "FAIL" : state.verdict === "UNSTABLE" ? "DEGRADED" : "PASS");
        const exitCode = verdict === "PASS" ? 0 : verdict === "DEGRADED" ? 1 : 2;
        return NextResponse.json({
          testId,
          status: state.status,
          verdict,
          exitCode,
          metrics: state.metrics,
          safetyScore: state.safetyScore,
          thresholdVerdict: state.thresholdVerdict,
          verdictReasons: state.verdictReasons,
          firstViolationAt: state.firstViolationAt,
        });
      }
    }

    return NextResponse.json(
      { error: "Test did not complete within allowed time", testId },
      { status: 408 }
    );
  } catch (err) {
    console.error("Headless run error:", err);
    return NextResponse.json(
      { error: "Failed to run headless test" },
      { status: 500 }
    );
  }
}

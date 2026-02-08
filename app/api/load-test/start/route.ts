import { NextRequest, NextResponse } from "next/server";
import { startLoadTest } from "@/lib/engine";
import type {
  LoadTestConfig,
  PerformanceThresholds,
  LoadPatternConfig,
} from "@/lib/types";
import { isUrlAllowed, getUrlBlockReason } from "@/lib/safety";

function parseThresholds(body: Record<string, unknown>): PerformanceThresholds | undefined {
  const maxError = body.maxErrorRatePercent;
  const maxP95 = body.maxP95LatencyMs;
  const minSuccess = body.minSuccessRatePercent;
  if (maxError == null && maxP95 == null && minSuccess == null) return undefined;
  const t: PerformanceThresholds = {};
  if (typeof maxError === "number" && maxError >= 0) t.maxErrorRatePercent = maxError;
  if (typeof maxP95 === "number" && maxP95 > 0) t.maxP95LatencyMs = maxP95;
  if (typeof minSuccess === "number" && minSuccess >= 0) t.minSuccessRatePercent = minSuccess;
  return Object.keys(t).length ? t : undefined;
}

function parseLoadPattern(body: Record<string, unknown>): LoadPatternConfig | undefined {
  const type = body.loadPatternType ?? (body.loadPattern as { type?: string } | undefined)?.type;
  if (!type || typeof type !== "string") return undefined;
  const valid: LoadPatternConfig["type"][] = [
    "fixed_concurrency",
    "fixed_rps",
    "ramp_up",
    "spike",
  ];
  if (!valid.includes(type as LoadPatternConfig["type"])) return undefined;
  const cfg: LoadPatternConfig = { type: type as LoadPatternConfig["type"] };
  if (type === "fixed_rps" && typeof body.targetRps === "number")
    cfg.targetRps = body.targetRps;
  if (type === "ramp_up" && typeof body.rampUpSeconds === "number")
    cfg.rampUpSeconds = body.rampUpSeconds;
  if (type === "spike") {
    if (typeof body.spikeConcurrency === "number") cfg.spikeConcurrency = body.spikeConcurrency;
    if (typeof body.spikeDurationSeconds === "number")
      cfg.spikeDurationSeconds = body.spikeDurationSeconds;
  }
  return cfg;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      targetUrl,
      method = "GET",
      concurrentUsers = 1,
      durationSeconds = 10,
      requestTimeoutMs = 5000,
      confirmed = false,
      headless = false,
    } = body;

    if (!targetUrl || typeof targetUrl !== "string") {
      return NextResponse.json(
        { error: "targetUrl is required and must be a string" },
        { status: 400 }
      );
    }

    const url = targetUrl.trim();
    if (!isUrlAllowed(url)) {
      return NextResponse.json(
        { error: getUrlBlockReason(url) ?? "URL not allowed" },
        { status: 400 }
      );
    }

    if (!headless && !confirmed) {
      return NextResponse.json(
        { error: "User confirmation required. Set confirmed: true to start the test." },
        { status: 400 }
      );
    }

    const thresholds = parseThresholds(body);
    const loadPattern = parseLoadPattern(body);

    const config: LoadTestConfig = {
      targetUrl: url,
      method: method === "POST" ? "POST" : "GET",
      concurrentUsers: Math.max(1, Math.min(100, Number(concurrentUsers) || 1)),
      durationSeconds: Math.max(1, Math.min(300, Number(durationSeconds) || 10)),
      requestTimeoutMs: Math.max(
        1000,
        Math.min(60000, Number(requestTimeoutMs) || 5000)
      ),
      thresholds,
      loadPattern,
    };

    const testId = startLoadTest(config);
    return NextResponse.json({ testId });
  } catch (err) {
    console.error("Load test start error:", err);
    return NextResponse.json(
      { error: "Failed to start load test" },
      { status: 500 }
    );
  }
}

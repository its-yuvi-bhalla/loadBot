import { NextRequest, NextResponse } from "next/server";
import { getHistoryRecord } from "@/lib/history";
import { getTest } from "@/lib/store";

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get("ids");
  if (!ids) {
    return NextResponse.json(
      { error: "Query parameter 'ids' required (e.g. ids=id1,id2)" },
      { status: 400 }
    );
  }
  const idList = ids.split(",").map((s: string) => s.trim()).filter(Boolean);
  if (idList.length !== 2) {
    return NextResponse.json(
      { error: "Exactly two test ids required for comparison" },
      { status: 400 }
    );
  }

  const [aId, bId] = idList;
  const a = getTest(aId) ?? getHistoryRecord(aId);
  const b = getTest(bId) ?? getHistoryRecord(bId);

  if (!a || !b || !a.metrics || !b.metrics) {
    return NextResponse.json(
      { error: "One or both tests not found" },
      { status: 404 }
    );
  }

  const errorRateDelta = b.metrics.errorRatePercentage - a.metrics.errorRatePercentage;
  const p95Delta = b.metrics.p95ResponseTime - a.metrics.p95ResponseTime;
  const regression =
    errorRateDelta > 0 || p95Delta > 0
      ? "Error rate or P95 increased vs baseline (possible regression)."
      : "No regression: error rate and P95 same or better.";

  return NextResponse.json({
    testA: { id: a.id, metrics: a.metrics },
    testB: { id: b.id, metrics: b.metrics },
    delta: {
      errorRatePercentage: Math.round(errorRateDelta * 100) / 100,
      p95ResponseTimeMs: Math.round(p95Delta * 100) / 100,
    },
    regression: errorRateDelta > 0 || p95Delta > 0,
    regressionNote: regression,
  });
}

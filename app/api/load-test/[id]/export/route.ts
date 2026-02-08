import { NextRequest, NextResponse } from "next/server";
import { getTest } from "@/lib/store";
import { getHistoryRecord } from "@/lib/history";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const state = getTest(id) ?? getHistoryRecord(id);
  if (!state) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }

  const format = request.nextUrl.searchParams.get("format") ?? "json";
  if (format !== "csv" && format !== "json") {
    return NextResponse.json(
      { error: "format must be csv or json" },
      { status: 400 }
    );
  }

  const config = state.config;
  const metrics = state.metrics;
  const timeSeries = "timeSeries" in state && Array.isArray(state.timeSeries) ? state.timeSeries : [];
  const safetyScore = state.safetyScore;
  const thresholdVerdict = "thresholdVerdict" in state ? state.thresholdVerdict : undefined;
  const verdictReasons = "verdictReasons" in state ? state.verdictReasons : undefined;
  const firstViolationAt = "firstViolationAt" in state ? state.firstViolationAt : undefined;

  if (format === "json") {
    const payload = {
      id: state.id,
      config,
      metrics,
      safetyScore,
      thresholdVerdict,
      verdictReasons,
      firstViolationAt,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      timeSeries,
    };
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="loadtest-${id}.json"`,
      },
    });
  }

  const rows: string[][] = [
    ["time_ms", "response_time_ms", "error_rate_pct", "success_count", "fail_count"],
    ...timeSeries.map((t) => [
      String(t.time),
      String(t.responseTime),
      String(t.errorRate),
      String(t.successCount),
      String(t.failCount),
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="loadtest-${id}.csv"`,
    },
  });
}

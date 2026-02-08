import { NextRequest, NextResponse } from "next/server";
import { getTest } from "@/lib/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const state = getTest(id);
  if (!state) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: state.id,
    status: state.status,
    config: state.config,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    metrics: state.metrics,
    verdict: state.verdict,
    thresholdVerdict: state.thresholdVerdict,
    verdictReasons: state.verdictReasons,
    firstViolationAt: state.firstViolationAt,
  });
}

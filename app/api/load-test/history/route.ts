import { NextResponse } from "next/server";
import { getHistory } from "@/lib/history";

export async function GET() {
  const list = getHistory();
  return NextResponse.json({ tests: list });
}

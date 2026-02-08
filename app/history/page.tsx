"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";

interface TestRecord {
  id: string;
  config: { targetUrl: string; method: string; durationSeconds: number };
  metrics: {
    totalRequests: number;
    errorRatePercentage: number;
    p95ResponseTime: number;
    requestsPerSecond: number;
  };
  safetyScore?: { score: number; label: string };
  verdict: string;
  thresholdVerdict?: string;
  startedAt: number;
  completedAt: number;
}

export default function HistoryPage() {
  const [tests, setTests] = useState<TestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareResult, setCompareResult] = useState<{
    delta: { errorRatePercentage: number; p95ResponseTimeMs: number };
    regression: boolean;
    regressionNote: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/load-test/history")
      .then((res) => res.json())
      .then((data) => setTests(data.tests ?? []))
      .catch(() => setTests([]))
      .finally(() => setLoading(false));
  }, []);

  function toggleCompare(id: string) {
    setCompareResult(null);
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id]
    );
  }

  useEffect(() => {
    if (compareIds.length !== 2) {
      setCompareResult(null);
      return;
    }
    fetch(`/api/load-test/compare?ids=${compareIds.join(",")}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => (data ? setCompareResult({ delta: data.delta, regression: data.regression, regressionNote: data.regressionNote }) : setCompareResult(null)))
      .catch(() => setCompareResult(null));
  }, [compareIds]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-10">
          <p className="text-[var(--muted)]">Loading history…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-semibold text-[var(--foreground)]">
          Test history
        </h1>

        {tests.length === 0 ? (
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-8 text-center">
            <p className="text-[var(--muted)]">No completed tests yet.</p>
            <Link href="/" className="mt-4 inline-block text-[var(--accent)] hover:underline">
              Run your first test
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-[var(--muted)]">
              Select two tests to compare (baseline vs current). Regression = error rate or P95 increased.
            </p>
            <ul className="space-y-3">
              {tests.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">
                      {t.config.targetUrl}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {new Date(t.startedAt).toLocaleString()} · {t.config.durationSeconds}s ·{" "}
                      {t.metrics.totalRequests} req · {t.metrics.errorRatePercentage.toFixed(1)}% err · P95{" "}
                      {t.metrics.p95ResponseTime.toFixed(0)}ms
                    </p>
                    <p className="mt-1 text-xs">
                      Verdict:{" "}
                      <span
                        className={
                          t.thresholdVerdict === "FAIL"
                            ? "text-[var(--danger)]"
                            : t.thresholdVerdict === "DEGRADED"
                              ? "text-[var(--warning)]"
                              : "text-[var(--success)]"
                        }
                      >
                        {t.thresholdVerdict ?? t.verdict}
                      </span>
                      {t.safetyScore != null && (
                        <span className="ml-2">
                          Safety: {t.safetyScore.score} ({t.safetyScore.label})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCompare(t.id)}
                      className={`rounded border px-2 py-1 text-xs ${
                        compareIds.includes(t.id)
                          ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                          : "border-[var(--card-border)] text-[var(--muted)] hover:bg-[var(--background)]"
                      }`}
                    >
                      {compareIds.includes(t.id) ? "Selected" : "Compare"}
                    </button>
                    <Link
                      href={`/results/${t.id}`}
                      className="rounded border border-[var(--card-border)] px-2 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--background)]"
                    >
                      View
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            {compareResult && (
              <div className="mt-6 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm">
                <h2 className="mb-2 text-lg font-medium text-[var(--foreground)]">
                  Comparison (A → B)
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  Error rate delta: {compareResult.delta.errorRatePercentage >= 0 ? "+" : ""}
                  {compareResult.delta.errorRatePercentage.toFixed(2)}% · P95 delta:{" "}
                  {compareResult.delta.p95ResponseTimeMs >= 0 ? "+" : ""}
                  {compareResult.delta.p95ResponseTimeMs.toFixed(0)} ms
                </p>
                <p
                  className={`mt-2 text-sm font-medium ${
                    compareResult.regression ? "text-[var(--danger)]" : "text-[var(--success)]"
                  }`}
                >
                  {compareResult.regressionNote}
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/Header";

interface StatusSnapshot {
  id: string;
  status: string;
  config?: { durationSeconds?: number };
  startedAt: number;
  completedAt?: number;
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    errorRatePercentage: number;
    requestsPerSecond: number;
    avgResponseTime: number;
  };
  verdict: string;
  thresholdVerdict?: string;
  verdictReasons?: { message: string }[];
  firstViolationAt?: number;
}

export default function LiveTestPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params.testId as string;
  const [status, setStatus] = useState<StatusSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!testId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/load-test/${testId}/status`);
        if (!res.ok) {
          setError("Test not found");
          return;
        }
        const data = await res.json();
        setStatus(data);
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
          router.replace(`/results/${testId}`);
        }
      } catch {
        setError("Failed to fetch status");
      }
    }, 500);
    return () => clearInterval(interval);
  }, [testId, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-10">
          <p className="text-[var(--danger)]">{error}</p>
          <a href="/" className="mt-4 inline-block text-[var(--accent)] hover:underline">
            Back to home
          </a>
        </main>
      </div>
    );
  }

  const duration = status?.startedAt
    ? (status.completedAt ?? Date.now()) - status.startedAt
    : 0;
  const durationSeconds = status?.config?.durationSeconds ?? 10;
  const progress = status
    ? Math.min(100, (duration / 1000 / durationSeconds) * 100)
    : 0;
  const displayVerdict = status?.thresholdVerdict ?? status?.verdict;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-semibold text-[var(--foreground)]">
          Live test
        </h1>

        {status && (
          <>
            <div className="mb-6">
              <div className="mb-2 flex justify-between text-sm text-[var(--muted)]">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--card)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm">
                <p className="text-sm text-[var(--muted)]">Requests/sec</p>
                <p className="text-2xl font-semibold text-[var(--foreground)]">
                  {status.metrics.requestsPerSecond.toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm">
                <p className="text-sm text-[var(--muted)]">Success / Fail</p>
                <p className="text-2xl font-semibold text-[var(--success)]">
                  {status.metrics.successfulRequests}
                </p>
                <p className="text-lg text-[var(--danger)]">
                  {status.metrics.failedRequests}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm">
                <p className="text-sm text-[var(--muted)]">Error rate</p>
                <p
                  className={`text-2xl font-semibold ${
                    status.metrics.errorRatePercentage > 60
                      ? "text-[var(--danger)]"
                      : status.metrics.errorRatePercentage > 30
                        ? "text-[var(--warning)]"
                        : "text-[var(--foreground)]"
                  }`}
                >
                  {status.metrics.errorRatePercentage.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm">
                <p className="text-sm text-[var(--muted)]">Total requests</p>
                <p className="text-2xl font-semibold text-[var(--foreground)]">
                  {status.metrics.totalRequests}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm">
                <p className="text-sm text-[var(--muted)]">Avg response time</p>
                <p className="text-2xl font-semibold text-[var(--foreground)]">
                  {status.metrics.avgResponseTime.toFixed(0)} ms
                </p>
              </div>
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm">
                <p className="text-sm text-[var(--muted)]">Verdict</p>
                <p
                  className={`text-lg font-semibold ${
                    displayVerdict === "FAIL" || displayVerdict === "CRITICAL"
                      ? "text-[var(--danger)]"
                      : displayVerdict === "DEGRADED" || displayVerdict === "UNSTABLE"
                        ? "text-[var(--warning)]"
                        : "text-[var(--success)]"
                  }`}
                >
                  {displayVerdict}
                </p>
              </div>
            </div>

            {status.verdictReasons != null && status.verdictReasons.length > 0 && (
              <div className="mt-4 rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-3 text-sm text-[var(--muted)]">
                <p className="font-medium text-[var(--foreground)]">Threshold reasons:</p>
                <ul className="mt-1 list-disc pl-4">
                  {status.verdictReasons.map((r, i) => (
                    <li key={i}>{r.message}</li>
                  ))}
                </ul>
                {status.firstViolationAt != null && (
                  <p className="mt-2 text-xs">First violation: {new Date(status.firstViolationAt).toLocaleTimeString()}</p>
                )}
              </div>
            )}

            {status.status === "running" && (
              <p className="mt-6 text-center text-sm text-[var(--muted)]">
                Test in progress… You will be redirected to results when complete.
              </p>
            )}
          </>
        )}

        {!status && !error && (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            <p className="text-[var(--muted)]">Loading test status…</p>
          </div>
        )}
      </main>
    </div>
  );
}

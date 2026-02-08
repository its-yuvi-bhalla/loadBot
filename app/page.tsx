"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { ConfirmModal } from "@/components/ConfirmModal";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { getPatternPreview } from "@/lib/load-patterns";
import type { LoadPatternConfig } from "@/lib/types";

const TEMPLATES = {
  smoke: {
    name: "Smoke test",
    targetUrl: "https://httpbin.org/get",
    method: "GET" as const,
    concurrentUsers: 2,
    durationSeconds: 10,
    requestTimeoutMs: 5000,
    loadPatternType: "fixed_concurrency" as const,
  },
  stress: {
    name: "Stress test",
    targetUrl: "https://httpbin.org/get",
    method: "GET" as const,
    concurrentUsers: 20,
    durationSeconds: 30,
    requestTimeoutMs: 10000,
    loadPatternType: "ramp_up" as const,
    rampUpSeconds: 10,
  },
  spike: {
    name: "Spike test",
    targetUrl: "https://httpbin.org/get",
    method: "GET" as const,
    concurrentUsers: 5,
    durationSeconds: 20,
    requestTimeoutMs: 5000,
    loadPatternType: "spike" as const,
    spikeConcurrency: 15,
    spikeDurationSeconds: 5,
  },
};

export default function HomePage() {
  const router = useRouter();
  const [targetUrl, setTargetUrl] = useState("https://httpbin.org/get");
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [concurrentUsers, setConcurrentUsers] = useState(5);
  const [durationSeconds, setDurationSeconds] = useState(10);
  const [requestTimeoutMs, setRequestTimeoutMs] = useState(5000);
  const [loadPatternType, setLoadPatternType] = useState<LoadPatternConfig["type"]>("fixed_concurrency");
  const [targetRps, setTargetRps] = useState(10);
  const [rampUpSeconds, setRampUpSeconds] = useState(10);
  const [spikeConcurrency, setSpikeConcurrency] = useState(15);
  const [spikeDurationSeconds, setSpikeDurationSeconds] = useState(5);
  const [maxErrorRatePercent, setMaxErrorRatePercent] = useState<number | "">("");
  const [maxP95LatencyMs, setMaxP95LatencyMs] = useState<number | "">("");
  const [minSuccessRatePercent, setMinSuccessRatePercent] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadPattern: LoadPatternConfig | undefined = useMemo(() => {
    if (loadPatternType === "fixed_concurrency") return undefined;
    if (loadPatternType === "fixed_rps") return { type: "fixed_rps", targetRps };
    if (loadPatternType === "ramp_up") return { type: "ramp_up", rampUpSeconds };
    if (loadPatternType === "spike") return { type: "spike", spikeConcurrency, spikeDurationSeconds };
    return undefined;
  }, [loadPatternType, targetRps, rampUpSeconds, spikeConcurrency, spikeDurationSeconds]);

  const patternPreview = useMemo(
    () => getPatternPreview(loadPattern, durationSeconds, concurrentUsers),
    [loadPattern, durationSeconds, concurrentUsers]
  );

  const thresholds = useMemo(() => {
    const t: { maxErrorRatePercent?: number; maxP95LatencyMs?: number; minSuccessRatePercent?: number } = {};
    if (typeof maxErrorRatePercent === "number") t.maxErrorRatePercent = maxErrorRatePercent;
    if (typeof maxP95LatencyMs === "number") t.maxP95LatencyMs = maxP95LatencyMs;
    if (typeof minSuccessRatePercent === "number") t.minSuccessRatePercent = minSuccessRatePercent;
    return Object.keys(t).length ? t : undefined;
  }, [maxErrorRatePercent, maxP95LatencyMs, minSuccessRatePercent]);

  function applyTemplate(key: keyof typeof TEMPLATES) {
    const t = TEMPLATES[key];
    setTargetUrl(t.targetUrl);
    setMethod(t.method);
    setConcurrentUsers(t.concurrentUsers);
    setDurationSeconds(t.durationSeconds);
    setRequestTimeoutMs(t.requestTimeoutMs);
    setLoadPatternType(t.loadPatternType);
    if ("rampUpSeconds" in t && t.rampUpSeconds != null) setRampUpSeconds(t.rampUpSeconds);
    if ("spikeConcurrency" in t && t.spikeConcurrency != null) setSpikeConcurrency(t.spikeConcurrency);
    if ("spikeDurationSeconds" in t && t.spikeDurationSeconds != null) setSpikeDurationSeconds(t.spikeDurationSeconds);
  }

  async function startTest() {
    setShowConfirm(false);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/load-test/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: targetUrl.trim(),
          method,
          concurrentUsers,
          durationSeconds,
          requestTimeoutMs,
          confirmed: true,
          maxErrorRatePercent: typeof maxErrorRatePercent === "number" ? maxErrorRatePercent : undefined,
          maxP95LatencyMs: typeof maxP95LatencyMs === "number" ? maxP95LatencyMs : undefined,
          minSuccessRatePercent: typeof minSuccessRatePercent === "number" ? minSuccessRatePercent : undefined,
          loadPatternType,
          targetRps: loadPatternType === "fixed_rps" ? targetRps : undefined,
          rampUpSeconds: loadPatternType === "ramp_up" ? rampUpSeconds : undefined,
          spikeConcurrency: loadPatternType === "spike" ? spikeConcurrency : undefined,
          spikeDurationSeconds: loadPatternType === "spike" ? spikeDurationSeconds : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start test");
      router.push(`/test/${data.testId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-semibold text-[var(--foreground)]">
          Load Test Setup
        </h1>
        <p className="mb-6 text-[var(--muted)]">
          Configure your load test. Only test systems you own or have permission to test.
        </p>

        {/* Legal warning */}
        <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-400">
          <strong>Legal &amp; ethical warning:</strong> Use this tool only on systems you own or have
          explicit authorization to test. Unauthorized load testing may violate terms of service or
          applicable law. You are responsible for your use.
        </div>

        {/* Templates */}
        <div className="mb-6 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-[var(--foreground)]">Templates</p>
          <div className="flex flex-wrap gap-2">
            {(["smoke", "stress", "spike"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => applyTemplate(key)}
                className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] hover:opacity-90"
              >
                {TEMPLATES[key].name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
              Target URL
            </label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com/api"
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Localhost and private IPs are blocked for safety.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "GET" | "POST")}
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
              Concurrent users: {concurrentUsers}
            </label>
            <input
              type="range"
              min={1}
              max={50}
              value={concurrentUsers}
              onChange={(e) => setConcurrentUsers(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
              Duration (seconds)
            </label>
            <input
              type="number"
              min={1}
              max={300}
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(Number(e.target.value) || 10)}
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
              Request timeout (ms)
            </label>
            <input
              type="number"
              min={1000}
              max={60000}
              step={1000}
              value={requestTimeoutMs}
              onChange={(e) => setRequestTimeoutMs(Number(e.target.value) || 5000)}
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Load pattern */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
              Load pattern
            </label>
            <select
              value={loadPatternType}
              onChange={(e) => setLoadPatternType(e.target.value as LoadPatternConfig["type"])}
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="fixed_concurrency">Fixed concurrency</option>
              <option value="fixed_rps">Fixed RPS</option>
              <option value="ramp_up">Ramp-up</option>
              <option value="spike">Spike</option>
            </select>
            {loadPatternType === "fixed_rps" && (
              <div className="mt-2">
                <label className="text-xs text-[var(--muted)]">Target RPS</label>
                <input
                  type="number"
                  min={1}
                  value={targetRps}
                  onChange={(e) => setTargetRps(Number(e.target.value) || 1)}
                  className="mt-1 w-full rounded border border-[var(--card-border)] bg-[var(--background)] px-2 py-1 text-sm"
                />
              </div>
            )}
            {loadPatternType === "ramp_up" && (
              <div className="mt-2">
                <label className="text-xs text-[var(--muted)]">Ramp-up (seconds)</label>
                <input
                  type="number"
                  min={1}
                  max={durationSeconds}
                  value={rampUpSeconds}
                  onChange={(e) => setRampUpSeconds(Number(e.target.value) || 1)}
                  className="mt-1 w-full rounded border border-[var(--card-border)] bg-[var(--background)] px-2 py-1 text-sm"
                />
              </div>
            )}
            {loadPatternType === "spike" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-[var(--muted)]">Spike concurrency</label>
                  <input
                    type="number"
                    min={concurrentUsers}
                    value={spikeConcurrency}
                    onChange={(e) => setSpikeConcurrency(Number(e.target.value) || concurrentUsers)}
                    className="mt-1 w-full rounded border border-[var(--card-border)] bg-[var(--background)] px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Spike duration (s)</label>
                  <input
                    type="number"
                    min={1}
                    max={durationSeconds}
                    value={spikeDurationSeconds}
                    onChange={(e) => setSpikeDurationSeconds(Number(e.target.value) || 1)}
                    className="mt-1 w-full rounded border border-[var(--card-border)] bg-[var(--background)] px-2 py-1 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Pattern preview */}
          {patternPreview.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--foreground)]">
                Load pattern preview
              </p>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={patternPreview}>
                    <XAxis dataKey="timeSec" type="number" stroke="var(--muted)" fontSize={10} />
                    <YAxis stroke="var(--muted)" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--card-border)",
                        borderRadius: "6px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="concurrency"
                      name="Concurrency"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Thresholds */}
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--foreground)]">
              Performance thresholds (optional)
            </p>
            <p className="mb-3 text-xs text-[var(--muted)]">
              Test can auto-stop on critical violation. Verdict: PASS / DEGRADED / FAIL.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs text-[var(--muted)]">Max error rate %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={maxErrorRatePercent === "" ? "" : maxErrorRatePercent}
                  onChange={(e) =>
                    setMaxErrorRatePercent(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="—"
                  className="mt-1 w-full rounded border border-[var(--card-border)] bg-[var(--background)] px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--muted)]">Max P95 latency (ms)</label>
                <input
                  type="number"
                  min={0}
                  value={maxP95LatencyMs === "" ? "" : maxP95LatencyMs}
                  onChange={(e) =>
                    setMaxP95LatencyMs(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="—"
                  className="mt-1 w-full rounded border border-[var(--card-border)] bg-[var(--background)] px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--muted)]">Min success rate %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={minSuccessRatePercent === "" ? "" : minSuccessRatePercent}
                  onChange={(e) =>
                    setMinSuccessRatePercent(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="—"
                  className="mt-1 w-full rounded border border-[var(--card-border)] bg-[var(--background)] px-2 py-1 text-sm"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={loading}
            className="w-full rounded-lg bg-[var(--accent)] py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Starting…" : "Start test"}
          </button>
        </div>
      </main>

      <ConfirmModal
        open={showConfirm}
        title="Confirm load test"
        message={
          <>
            <p className="mb-2">
              You are about to run a load test against <strong>{targetUrl || "the configured URL"}</strong>.
            </p>
            <p>
              Only proceed if you own this system or have explicit authorization. By starting, you
              confirm that you accept responsibility for this test.
            </p>
          </>
        }
        confirmLabel="I confirm, start test"
        cancelLabel="Cancel"
        onConfirm={startTest}
        onCancel={() => setShowConfirm(false)}
        danger
      />
    </div>
  );
}

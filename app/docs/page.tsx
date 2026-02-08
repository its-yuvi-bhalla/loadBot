import Link from "next/link";
import { Header } from "@/components/Header";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-8 text-3xl font-semibold text-[var(--foreground)]">
          Documentation
        </h1>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-medium text-[var(--foreground)]">
            What is load testing?
          </h2>
          <p className="text-[var(--muted)] leading-relaxed">
            Load testing simulates many users (or concurrent requests) hitting your
            service at once. It helps you find how your system behaves under
            stress: how many requests per second it can handle, how latency
            changes, and where it starts to fail. This tool runs workers in
            parallel, each sending repeated HTTP requests to a target URL for a
            set duration, then reports metrics and a safety score.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-medium text-[var(--foreground)]">
            How this tool works
          </h2>
          <p className="text-[var(--muted)] leading-relaxed mb-4">
            When you start a test, the backend spawns a number of concurrent
            workers equal to &quot;Concurrent users.&quot; Each worker runs in a loop until
            the test duration has elapsed. On every iteration it sends one HTTP
            request (GET or POST) to your target URL. Each request is measured
            for response time and success or failure. Failures include HTTP
            status ≥ 400, timeouts, and network errors. Results are aggregated
            in memory and exposed via the status and results APIs so the
            dashboard can show live metrics and final charts.
          </p>
          <ul className="list-disc pl-6 text-[var(--muted)] space-y-1">
            <li>
              <strong className="text-[var(--foreground)]">Worker concurrency:</strong>{" "}
              We use a simple Promise-based model: N workers are started with{" "}
              <code className="rounded bg-[var(--card)] px-1 py-0.5 text-sm">Promise.all</code>
              , each running an async loop that sends requests until the end time.
              No queue or job system—just in-process async workers.
            </li>
            <li>
              <strong className="text-[var(--foreground)]">Percentile calculation:</strong>{" "}
              Response times from successful requests are sorted; P95 and P99
              are computed by linear interpolation at the 0.95 and 0.99
              positions in the sorted array.
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-medium text-[var(--foreground)]">
            How to configure a test
          </h2>
          <ul className="list-disc pl-6 text-[var(--muted)] space-y-2">
            <li>
              <strong className="text-[var(--foreground)]">Target URL:</strong> The
              full URL to request (e.g. https://api.example.com/health).
            </li>
            <li>
              <strong className="text-[var(--foreground)]">Method:</strong> GET or
              POST. POST sends an empty JSON body.
            </li>
            <li>
              <strong className="text-[var(--foreground)]">Concurrent users:</strong> Number
              of parallel workers (1–50 in the UI; API allows up to 100).
            </li>
            <li>
              <strong className="text-[var(--foreground)]">Duration (seconds):</strong> How
              long the test runs (1–300).
            </li>
            <li>
              <strong className="text-[var(--foreground)]">Request timeout (ms):</strong> Max
              time per request before it is marked as failed (1–60 000 ms).
            </li>
            <li>
              <strong className="text-[var(--foreground)]">Thresholds (optional):</strong> Max
              error rate %, max P95 latency (ms), min success rate %. When violated, the test
              verdict becomes DEGRADED or FAIL; critical violations can auto-stop the test.
            </li>
            <li>
              <strong className="text-[var(--foreground)]">Load pattern:</strong> Fixed
              concurrency, fixed RPS, ramp-up, or spike. Use the pattern preview on the home
              page to visualize before running.
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-medium text-[var(--foreground)]">
            CI / headless execution
          </h2>
          <p className="text-[var(--muted)] leading-relaxed mb-4">
            Use <code className="rounded bg-[var(--card)] px-1 py-0.5 text-sm">POST /api/load-test/run-headless</code> to
            run a test and wait for completion. The response includes <code className="rounded bg-[var(--card)] px-1 py-0.5 text-sm">exitCode</code> for
            CI: 0 = PASS, 1 = DEGRADED, 2 = FAIL. Send the same body as the start API (targetUrl, method,
            concurrentUsers, durationSeconds, requestTimeoutMs, and optional thresholds/load pattern).
            No <code className="rounded bg-[var(--card)] px-1 py-0.5 text-sm">confirmed</code> flag is required for headless.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-medium text-[var(--foreground)]">
            Export &amp; test history
          </h2>
          <p className="text-[var(--muted)] leading-relaxed mb-4">
            From the results page you can export metrics over time as <strong>CSV</strong>, full
            result as <strong>JSON</strong>, or open a <strong>PDF report</strong> (print dialog).
            The <strong>History</strong> page lists completed tests; select two to compare
            error rate and P95 deltas and see a regression indicator.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-medium text-[var(--foreground)]">
            Safety constraints
          </h2>
          <p className="text-[var(--muted)] leading-relaxed">
            Localhost and private IP ranges are blocked. Outgoing requests are rate-limited
            globally. Starting a test from the UI requires explicit confirmation (legal/ethical
            warning). Headless/API runs do not require confirmation but still enforce URL
            and rate limits.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-medium text-[var(--foreground)]">
            How the safety score is calculated
          </h2>
          <p className="text-[var(--muted)] leading-relaxed mb-4">
            The safety score is a number from 0 to 100. We start at 100 and
            subtract points for:
          </p>
          <ul className="list-disc pl-6 text-[var(--muted)] space-y-1">
            <li>
              <strong className="text-[var(--foreground)]">Error rate:</strong> About 0.8
              points per percentage point of error rate (capped so the total
              penalty is not excessive).
            </li>
            <li>
              <strong className="text-[var(--foreground)]">High P95 latency:</strong> If
              P95 response time is above 500 ms, we apply a penalty that grows
              with how much it exceeds that threshold (e.g. 2 points per 100 ms),
              up to a cap.
            </li>
            <li>
              <strong className="text-[var(--foreground)]">Low throughput:</strong> If
              requests per second fall below 1, a fixed penalty (e.g. 10 points)
              is applied to reflect possible system strain.
            </li>
          </ul>
          <p className="text-[var(--muted)] leading-relaxed mt-4">
            Labels: <span className="text-[var(--safe)]">80–100 = SAFE</span>,{" "}
            <span className="text-[var(--warning)]">50–79 = WARNING</span>,{" "}
            <span className="text-[var(--danger)]">below 50 = DANGEROUS</span>.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-medium text-[var(--foreground)]">
            Performance thresholds &amp; verdict
          </h2>
          <p className="text-[var(--muted)] leading-relaxed mb-4">
            You can set max error rate (%), max P95 latency (ms), and min success rate (%).
            During the test these are evaluated continuously. If a critical threshold is
            violated (e.g. error rate above max), the test can auto-stop. Final verdict is
            PASS (all within limits), DEGRADED (e.g. P95 over limit), or FAIL (error/success
            limits violated). The UI shows which threshold(s) failed and the timestamp of
            first violation.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-medium text-[var(--foreground)]">
            Legal and ethical warning
          </h2>
          <p className="text-[var(--muted)] leading-relaxed">
            Only run load tests against systems you own or have explicit
            permission to test. Unauthorized load testing can overload services,
            violate terms of use, and in some jurisdictions may be illegal.
            You are responsible for ensuring your use of this tool complies
            with applicable laws and policies.
          </p>
        </section>

        <p className="pt-4">
          <Link
            href="/"
            className="text-[var(--accent)] hover:underline"
          >
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}

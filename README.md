# LoadBot — Load Testing Web Application

A minimal, full-stack load testing web app built with Next.js (App Router), TypeScript, Tailwind CSS, and Recharts. Run concurrent HTTP load tests, view live metrics, and see results with a safety score and charts.

## Tech stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Recharts
- **Backend:** Next.js API route handlers (Node.js)
- **State:** React hooks only (no Redux)
- **Features:** Dark/light mode (default: dark), responsive UI

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use the home page to configure and start a test; you’ll be taken to the live dashboard, then to the results page when the test completes.

## What it does

- **Load test engine:** Async workers, GET/POST, configurable URL, method, concurrent users, duration, timeout. **Load patterns:** fixed concurrency, fixed RPS, ramp-up, spike.
- **Performance thresholds:** Optional max error rate %, max P95 latency (ms), min success rate %. Continuous evaluation; critical violations auto-stop the test. **Verdict:** PASS / DEGRADED / FAIL with reasons and first-violation timestamp.
- **Metrics:** Total/success/failed, error rate %, RPS, avg/min/max/P95/P99, timeout count. **Safety score (0–100):** P95 weighted higher than avg; timeouts penalized more than HTTP errors. Labels: SAFE / WARNING / DANGEROUS.
- **Safety:** Localhost and private IPs blocked; global rate limit; UI requires explicit confirmation before start.
- **Test history:** Completed runs persisted in memory; History page to list and compare two tests (error rate & P95 delta, regression indicator).
- **Export:** CSV (metrics over time), JSON (full result), PDF (printable summary report).
- **CI / headless:** `POST /api/load-test/run-headless` — runs test and returns JSON with `exitCode`: 0 = PASS, 1 = DEGRADED, 2 = FAIL.

## API

- **POST /api/load-test/start** — Body: `{ targetUrl, method?, concurrentUsers?, durationSeconds?, requestTimeoutMs?, confirmed, thresholds?, loadPattern? }`. Returns `{ testId }`. `confirmed: true` required for UI.
- **GET /api/load-test/:id/status** — Running status, live metrics, threshold verdict, verdict reasons, firstViolationAt.
- **GET /api/load-test/:id/results** — Final metrics, safety score, threshold verdict, time-series.
- **GET /api/load-test/:id/export?format=csv|json** — Download CSV or JSON.
- **GET /api/load-test/history** — List completed tests.
- **GET /api/load-test/compare?ids=id1,id2** — Compare two tests (deltas, regression).
- **POST /api/load-test/run-headless** — Run test and wait for completion; returns result + exitCode for CI.

Results and history are stored in memory; the store can be swapped for a database later.

## Documentation

The **[/docs](http://localhost:3000/docs)** page explains:

- What load testing is
- How this tool works (worker concurrency, percentile calculation)
- How to configure a test
- How the safety score is calculated
- Legal and ethical warning (test only systems you own or have permission to test)

## Project structure

- `app/` — Home (templates, thresholds, load pattern, confirm modal), `test/[testId]/` (live dashboard), `results/[testId]/` (charts, timeline, export), `history/` (list, compare), `docs/`, `api/load-test/` (start, status, results, history, compare, export, run-headless).
- `components/` — Header, ThemeProvider, ThemeToggle, ConfirmModal.
- `lib/` — `types`, `store`, `metrics`, `safety-score` (improved: P95/timeout weights), `safety` (URL validation, rate limit), `verdict` (threshold evaluation), `load-patterns` (preview, concurrency over time), `history`, `engine`.

## Legal

Use this tool only on systems you own or have explicit authorization to test. Unauthorized load testing may violate terms of service or law.

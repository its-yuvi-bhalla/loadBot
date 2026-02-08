/**
 * In-memory store for load test state.
 * Can be swapped for a database later by replacing this module.
 */
import type { LoadTestState } from "./types";

const tests = new Map<string, LoadTestState>();

export function getTest(id: string): LoadTestState | undefined {
  return tests.get(id);
}

export function setTest(id: string, state: LoadTestState): void {
  tests.set(id, state);
}

export function updateTest(
  id: string,
  updater: (state: LoadTestState) => void
): void {
  const state = tests.get(id);
  if (state) {
    updater(state);
    tests.set(id, state);
  }
}

export function deleteTest(id: string): void {
  tests.delete(id);
}

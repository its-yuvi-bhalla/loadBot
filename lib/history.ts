import type { TestHistoryRecord } from "./types";

const MAX_HISTORY = 100;
const history: TestHistoryRecord[] = [];

export function addToHistory(record: TestHistoryRecord): void {
  history.unshift(record);
  if (history.length > MAX_HISTORY) {
    history.pop();
  }
}

export function getHistory(): TestHistoryRecord[] {
  return [...history];
}

export function getHistoryRecord(id: string): TestHistoryRecord | undefined {
  return history.find((r) => r.id === id);
}

export function getHistoryRecords(ids: string[]): TestHistoryRecord[] {
  const set = new Set(ids);
  return history.filter((r) => set.has(r.id));
}

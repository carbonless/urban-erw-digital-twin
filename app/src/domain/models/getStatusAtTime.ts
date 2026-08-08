import type { StatusHistoryEntry } from './types';

/**
 * Resolves the effective status at a given point in time from a status history.
 *
 * Algorithm:
 * 1. Find all status history entries with effectiveTime <= currentTime
 * 2. Among those, select the one with the latest effectiveTime (most recent transition)
 * 3. Return its newStatus
 * 4. If no entry qualifies, return the provided defaultStatus
 *
 * @param statusHistory Sorted or unsorted array of status transitions
 * @param currentTime The point in time to evaluate
 * @param defaultStatus The status to return when no history entry applies
 * @returns The resolved status string at the given time
 */
export function getStatusAtTime(
  statusHistory: StatusHistoryEntry[],
  currentTime: Date,
  defaultStatus: string,
): string {
  if (statusHistory.length === 0) {
    return defaultStatus;
  }

  const currentMs = currentTime.getTime();
  let latestEntry: StatusHistoryEntry | null = null;
  let latestMs = -Infinity;

  for (const entry of statusHistory) {
    const entryMs = entry.effectiveTime.getTime();
    if (entryMs <= currentMs && entryMs > latestMs) {
      latestMs = entryMs;
      latestEntry = entry;
    }
  }

  return latestEntry ? latestEntry.newStatus : defaultStatus;
}

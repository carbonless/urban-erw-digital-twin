import type { ScenarioPhase } from '../../domain/models';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ScenarioEvent {
  time: Date;
  label: string;
  phase: ScenarioPhase;
}

// ─── Event Boundary Navigation ─────────────────────────────────────────────

/**
 * Finds the next event boundary after the given time.
 * Returns null if currentTime is at or after the last event.
 *
 * @param events Sorted array of scenario events (ascending by time)
 * @param currentTime The current timeline position
 * @returns The next ScenarioEvent, or null if at the end
 */
export function getNextEventBoundary(
  events: ScenarioEvent[],
  currentTime: Date,
): ScenarioEvent | null {
  const currentMs = currentTime.getTime();

  for (const event of events) {
    if (event.time.getTime() > currentMs) {
      return event;
    }
  }

  return null;
}

/**
 * Finds the previous event boundary before the given time.
 * Returns null if currentTime is at or before the first event.
 *
 * @param events Sorted array of scenario events (ascending by time)
 * @param currentTime The current timeline position
 * @returns The previous ScenarioEvent, or null if at the start
 */
export function getPreviousEventBoundary(
  events: ScenarioEvent[],
  currentTime: Date,
): ScenarioEvent | null {
  const currentMs = currentTime.getTime();

  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].time.getTime() < currentMs) {
      return events[i];
    }
  }

  return null;
}

/**
 * Checks if the current time has reached or passed the final event.
 * Used to trigger auto-pause.
 */
export function isAtFinalEvent(
  events: ScenarioEvent[],
  currentTime: Date,
): boolean {
  if (events.length === 0) return false;
  const lastEvent = events[events.length - 1];
  return currentTime.getTime() >= lastEvent.time.getTime();
}

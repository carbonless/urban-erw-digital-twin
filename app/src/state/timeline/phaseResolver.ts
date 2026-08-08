import type { ScenarioPhase } from '../../domain/models';
import type { ScenarioEvent } from './eventBoundary';

// ─── Phase Definition ──────────────────────────────────────────────────────

export interface PhaseDefinition {
  phase: ScenarioPhase;
  label: string;
  startTime: Date;
  endTime: Date; // exclusive — next phase starts here
}

// ─── Phase Resolution ──────────────────────────────────────────────────────

/**
 * Resolves the current scenario phase from the timeline position.
 *
 * Rules:
 * - Each time maps to exactly one phase (no overlaps or gaps)
 * - Before the first phase start → returns first phase
 * - After the last phase end → returns last phase
 *
 * @param phases Array of phase definitions, sorted by startTime
 * @param currentTime The current timeline position
 * @returns The resolved phase and its label
 */
export function resolvePhase(
  phases: PhaseDefinition[],
  currentTime: Date,
): { phase: ScenarioPhase; label: string } {
  if (phases.length === 0) {
    return { phase: 'initial_state', label: 'Initial State' };
  }

  const currentMs = currentTime.getTime();

  // Before first phase
  if (currentMs < phases[0].startTime.getTime()) {
    return { phase: phases[0].phase, label: phases[0].label };
  }

  // Find the phase containing currentTime
  for (let i = 0; i < phases.length; i++) {
    const phaseDef = phases[i];
    const startMs = phaseDef.startTime.getTime();
    const endMs = phaseDef.endTime.getTime();

    if (currentMs >= startMs && currentMs < endMs) {
      return { phase: phaseDef.phase, label: phaseDef.label };
    }
  }

  // After last phase — return last phase
  const lastPhase = phases[phases.length - 1];
  return { phase: lastPhase.phase, label: lastPhase.label };
}

/**
 * Creates phase definitions from scenario events.
 * Divides the scenario timeline into contiguous phases.
 */
export function buildPhaseDefinitions(
  events: ScenarioEvent[],
  scenarioEnd: Date,
): PhaseDefinition[] {
  if (events.length === 0) return [];

  const phases: PhaseDefinition[] = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const endTime = i < events.length - 1 ? events[i + 1].time : scenarioEnd;

    phases.push({
      phase: event.phase,
      label: formatPhaseLabel(event.phase),
      startTime: event.time,
      endTime,
    });
  }

  return phases;
}

function formatPhaseLabel(phase: ScenarioPhase): string {
  switch (phase) {
    case 'initial_state': return 'Initial State';
    case 'survey': return 'Survey';
    case 'clearance': return 'Clearance';
    case 'post_clearance': return 'Post-Clearance';
  }
}

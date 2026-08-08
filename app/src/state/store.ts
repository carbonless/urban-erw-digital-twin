import { create } from 'zustand';
import type { AppConfig } from '../config';
import type { DomainFeature, ScenarioPhase } from '../domain/models';
import type { ScenarioEvent } from './timeline/eventBoundary';
import { getNextEventBoundary, getPreviousEventBoundary, isAtFinalEvent } from './timeline/eventBoundary';
import { resolvePhase, buildPhaseDefinitions, type PhaseDefinition } from './timeline/phaseResolver';

// ─── Layer Error ───────────────────────────────────────────────────────────

export interface LayerError {
  layerName: string;
  message: string;
  timestamp: Date;
  retryCount: number;
}

// ─── App State ─────────────────────────────────────────────────────────────

export interface AppState {
  // Configuration
  config: AppConfig | null;
  setConfig: (config: AppConfig) => void;

  // Features
  features: DomainFeature[];
  featuresByLayer: Record<string, DomainFeature[]>;
  setFeatures: (features: DomainFeature[]) => void;

  // Layer visibility
  layerVisibility: Record<string, boolean>;
  toggleLayer: (layerKey: string) => void;
  setLayerVisibility: (layerKey: string, visible: boolean) => void;

  // Timeline
  timeline: {
    currentTime: Date;
    isPlaying: boolean;
    scenarioEvents: ScenarioEvent[];
    phases: PhaseDefinition[];
    currentPhase: ScenarioPhase;
    currentPhaseLabel: string;
  };
  stepForward: () => void;
  stepBackward: () => void;
  play: () => void;
  pause: () => void;
  seekTo: (time: Date) => void;
  setScenarioEvents: (events: ScenarioEvent[], scenarioEnd: Date) => void;

  // Selection
  selectedFeatureId: string | null;
  selectFeature: (id: string | null) => void;

  // Comparison mode
  comparisonActive: boolean;
  comparisonSavedTime: Date | null;
  toggleComparison: () => void;

  // Errors
  layerErrors: LayerError[];
  addLayerError: (layerName: string, message: string) => void;
  dismissError: (layerName: string) => void;
  retryLayer: (layerName: string) => void;

  // Reset
  resetToDefaults: () => void;
}

// ─── Default layer keys ────────────────────────────────────────────────────

const DEFAULT_LAYERS: Record<string, boolean> = {
  hazard_area: true,
  evidence_point: true,
  clearance_task: true,
  route: true,
  critical_infrastructure: true,
  urban_context: true,
  boundaries: true,
};

// ─── Session Storage Persistence ───────────────────────────────────────────

const LAYER_VISIBILITY_KEY = 'erw-dt-layer-visibility';

function loadPersistedLayerVisibility(): Record<string, boolean> {
  try {
    const stored = sessionStorage.getItem(LAYER_VISIBILITY_KEY);
    if (stored) {
      return JSON.parse(stored) as Record<string, boolean>;
    }
  } catch {
    // Ignore parse errors
  }
  return { ...DEFAULT_LAYERS };
}

function persistLayerVisibility(visibility: Record<string, boolean>): void {
  try {
    sessionStorage.setItem(LAYER_VISIBILITY_KEY, JSON.stringify(visibility));
  } catch {
    // Ignore storage errors
  }
}

// ─── Store ─────────────────────────────────────────────────────────────────

const initialTime = new Date();

export const useAppStore = create<AppState>((set, get) => ({
  // Configuration
  config: null,
  setConfig: (config) => set({ config }),

  // Features
  features: [],
  featuresByLayer: {},
  setFeatures: (features) => {
    const featuresByLayer: Record<string, DomainFeature[]> = {};
    for (const feature of features) {
      const key = feature.featureType;
      if (!featuresByLayer[key]) {
        featuresByLayer[key] = [];
      }
      featuresByLayer[key].push(feature);
    }
    set({ features, featuresByLayer });
  },

  // Layer visibility
  layerVisibility: loadPersistedLayerVisibility(),
  toggleLayer: (layerKey) => {
    const current = get().layerVisibility;
    const updated = { ...current, [layerKey]: !(current[layerKey] ?? true) };
    persistLayerVisibility(updated);
    set({ layerVisibility: updated });
  },
  setLayerVisibility: (layerKey, visible) => {
    const current = get().layerVisibility;
    const updated = { ...current, [layerKey]: visible };
    persistLayerVisibility(updated);
    set({ layerVisibility: updated });
  },

  // Timeline
  timeline: {
    currentTime: initialTime,
    isPlaying: false,
    scenarioEvents: [],
    phases: [],
    currentPhase: 'initial_state',
    currentPhaseLabel: 'Initial State',
  },

  stepForward: () => {
    const { timeline } = get();
    const next = getNextEventBoundary(timeline.scenarioEvents, timeline.currentTime);
    if (next) {
      const { phase, label } = resolvePhase(timeline.phases, next.time);
      set({
        timeline: {
          ...timeline,
          currentTime: next.time,
          currentPhase: phase,
          currentPhaseLabel: label,
          // Auto-pause at final event
          isPlaying: !isAtFinalEvent(timeline.scenarioEvents, next.time) && timeline.isPlaying,
        },
      });
    } else {
      // At the end — pause
      set({ timeline: { ...timeline, isPlaying: false } });
    }
  },

  stepBackward: () => {
    const { timeline } = get();
    const prev = getPreviousEventBoundary(timeline.scenarioEvents, timeline.currentTime);
    if (prev) {
      const { phase, label } = resolvePhase(timeline.phases, prev.time);
      set({
        timeline: {
          ...timeline,
          currentTime: prev.time,
          currentPhase: phase,
          currentPhaseLabel: label,
        },
      });
    }
  },

  play: () => {
    const { timeline } = get();
    // Don't play if already at end
    if (isAtFinalEvent(timeline.scenarioEvents, timeline.currentTime)) return;
    set({ timeline: { ...timeline, isPlaying: true } });
  },

  pause: () => {
    const { timeline } = get();
    set({ timeline: { ...timeline, isPlaying: false } });
  },

  seekTo: (time) => {
    const { timeline } = get();
    const { phase, label } = resolvePhase(timeline.phases, time);
    const atEnd = isAtFinalEvent(timeline.scenarioEvents, time);
    set({
      timeline: {
        ...timeline,
        currentTime: time,
        currentPhase: phase,
        currentPhaseLabel: label,
        isPlaying: atEnd ? false : timeline.isPlaying,
      },
    });
  },

  setScenarioEvents: (events, scenarioEnd) => {
    const { timeline } = get();
    const phases = buildPhaseDefinitions(events, scenarioEnd);
    const startTime = events.length > 0 ? events[0].time : initialTime;
    const { phase, label } = resolvePhase(phases, startTime);
    set({
      timeline: {
        ...timeline,
        scenarioEvents: events,
        phases,
        currentTime: startTime,
        currentPhase: phase,
        currentPhaseLabel: label,
        isPlaying: false,
      },
    });
  },

  // Selection
  selectedFeatureId: null,
  selectFeature: (id) => set({ selectedFeatureId: id }),

  // Comparison mode
  comparisonActive: false,
  comparisonSavedTime: null,
  toggleComparison: () => {
    const { comparisonActive, timeline } = get();
    if (!comparisonActive) {
      // Entering comparison: save current time, jump to initial state
      const initialEvent = timeline.scenarioEvents[0];
      if (initialEvent) {
        const { phase, label } = resolvePhase(timeline.phases, initialEvent.time);
        set({
          comparisonActive: true,
          comparisonSavedTime: timeline.currentTime,
          timeline: {
            ...timeline,
            currentTime: initialEvent.time,
            currentPhase: phase,
            currentPhaseLabel: label,
            isPlaying: false,
          },
        });
      } else {
        set({ comparisonActive: true, comparisonSavedTime: timeline.currentTime });
      }
    } else {
      // Exiting comparison: restore saved time
      const savedTime = get().comparisonSavedTime ?? timeline.currentTime;
      const { phase, label } = resolvePhase(timeline.phases, savedTime);
      set({
        comparisonActive: false,
        comparisonSavedTime: null,
        timeline: {
          ...timeline,
          currentTime: savedTime,
          currentPhase: phase,
          currentPhaseLabel: label,
        },
      });
    }
  },

  // Errors
  layerErrors: [],
  addLayerError: (layerName, message) => {
    const errors = get().layerErrors;
    const existing = errors.find((e) => e.layerName === layerName);
    if (existing) {
      set({
        layerErrors: errors.map((e) =>
          e.layerName === layerName
            ? { ...e, message, timestamp: new Date(), retryCount: e.retryCount + 1 }
            : e,
        ),
      });
    } else {
      set({
        layerErrors: [...errors, { layerName, message, timestamp: new Date(), retryCount: 0 }],
      });
    }
  },
  dismissError: (layerName) => {
    set({ layerErrors: get().layerErrors.filter((e) => e.layerName !== layerName) });
  },
  retryLayer: (layerName) => {
    // Mark for retry — the data loading pipeline watches this
    set({ layerErrors: get().layerErrors.filter((e) => e.layerName !== layerName) });
  },

  // Reset
  resetToDefaults: () => {
    const { timeline } = get();
    const defaultVisibility = { ...DEFAULT_LAYERS };
    persistLayerVisibility(defaultVisibility);

    const startTime = timeline.scenarioEvents.length > 0
      ? timeline.scenarioEvents[0].time
      : initialTime;
    const { phase, label } = resolvePhase(timeline.phases, startTime);

    set({
      layerVisibility: defaultVisibility,
      selectedFeatureId: null,
      comparisonActive: false,
      comparisonSavedTime: null,
      layerErrors: [],
      timeline: {
        ...timeline,
        currentTime: startTime,
        isPlaying: false,
        currentPhase: phase,
        currentPhaseLabel: label,
      },
    });
  },
}));

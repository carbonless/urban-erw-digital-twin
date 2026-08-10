/**
 * Style configuration for the Urban ERW Digital Twin.
 *
 * Each feature type + status combination has a unique visual style
 * differentiated by color + at least one supplementary differentiator
 * (pattern, icon, label, or outline style).
 */

export interface FeatureStyle {
  fillColor: string;       // CSS color value (hex or rgba)
  strokeColor: string;     // Border/outline color
  strokeWidth: number;     // Border width in pixels
  opacity: number;         // Fill opacity 0.0–1.0
  pattern?: string;        // Fill pattern ('solid' | 'hatched' | 'dotted' | 'crosshatch' | 'dashed')
  icon?: string;           // Icon identifier for point features
  label: string;           // Human-readable status label for legend
  shape?: string;          // Shape identifier ('circle' | 'triangle' | 'square' | 'diamond' | 'star')
}

export interface StyleConfig {
  [featureType: string]: {
    [status: string]: FeatureStyle;
  };
}

/**
 * Default style configuration.
 * Each status within a feature type is unique in (fillColor + one supplementary dimension).
 */
export const DEFAULT_STYLE_CONFIG: StyleConfig = {
  hazard_area: {
    suspected: {
      fillColor: '#FFA500',
      strokeColor: '#CC8400',
      strokeWidth: 2,
      opacity: 0.3,
      pattern: 'hatched',
      label: 'Suspected',
    },
    confirmed: {
      fillColor: '#FF0000',
      strokeColor: '#CC0000',
      strokeWidth: 3,
      opacity: 0.4,
      pattern: 'solid',
      label: 'Confirmed',
    },
    restricted: {
      fillColor: '#8B0000',
      strokeColor: '#5C0000',
      strokeWidth: 3,
      opacity: 0.5,
      pattern: 'crosshatch',
      label: 'Restricted',
    },
    surveyed: {
      fillColor: '#FFD700',
      strokeColor: '#B8960F',
      strokeWidth: 2,
      opacity: 0.35,
      pattern: 'dotted',
      label: 'Surveyed',
    },
    cleared: {
      fillColor: '#228B22',
      strokeColor: '#166B16',
      strokeWidth: 2,
      opacity: 0.3,
      pattern: 'dashed',
      label: 'Cleared',
    },
  },

  route: {
    primary: {
      fillColor: '#4169E1',
      strokeColor: '#4169E1',
      strokeWidth: 4,
      opacity: 1.0,
      pattern: 'solid',
      label: 'Primary',
    },
    restricted: {
      fillColor: '#FF8C00',
      strokeColor: '#FF8C00',
      strokeWidth: 4,
      opacity: 1.0,
      pattern: 'dashed',
      label: 'Restricted',
    },
    blocked: {
      fillColor: '#DC143C',
      strokeColor: '#DC143C',
      strokeWidth: 5,
      opacity: 1.0,
      pattern: 'crosshatch',
      label: 'Blocked',
    },
    reopened: {
      fillColor: '#32CD32',
      strokeColor: '#32CD32',
      strokeWidth: 4,
      opacity: 1.0,
      pattern: 'dotted',
      label: 'Reopened',
    },
  },

  evidence_point: {
    direct_evidence: {
      fillColor: '#FF4500',
      strokeColor: '#B83000',
      strokeWidth: 2,
      opacity: 0.9,
      icon: 'evidence-direct',
      shape: 'triangle',
      label: 'Direct Evidence',
    },
    indirect_evidence: {
      fillColor: '#FF6347',
      strokeColor: '#B84530',
      strokeWidth: 2,
      opacity: 0.8,
      icon: 'evidence-indirect',
      shape: 'diamond',
      label: 'Indirect Evidence',
    },
    victim_report: {
      fillColor: '#8B008B',
      strokeColor: '#5C005C',
      strokeWidth: 2,
      opacity: 0.9,
      icon: 'evidence-report',
      shape: 'circle',
      label: 'Victim Report',
    },
    informant_testimony: {
      fillColor: '#4B0082',
      strokeColor: '#2E004F',
      strokeWidth: 2,
      opacity: 0.85,
      icon: 'evidence-testimony',
      shape: 'square',
      label: 'Informant Testimony',
    },
    technical_survey_finding: {
      fillColor: '#006400',
      strokeColor: '#003D00',
      strokeWidth: 2,
      opacity: 0.9,
      icon: 'evidence-technical',
      shape: 'star',
      label: 'Technical Survey Finding',
    },
  },

  clearance_task: {
    planned: {
      fillColor: '#87CEEB',
      strokeColor: '#5BA3C9',
      strokeWidth: 2,
      opacity: 0.3,
      pattern: 'dotted',
      label: 'Planned',
    },
    in_progress: {
      fillColor: '#1E90FF',
      strokeColor: '#1570CC',
      strokeWidth: 3,
      opacity: 0.4,
      pattern: 'hatched',
      label: 'In Progress',
    },
    completed: {
      fillColor: '#2E8B57',
      strokeColor: '#1F5F3B',
      strokeWidth: 2,
      opacity: 0.35,
      pattern: 'solid',
      label: 'Completed',
    },
    suspended: {
      fillColor: '#A9A9A9',
      strokeColor: '#696969',
      strokeWidth: 2,
      opacity: 0.4,
      pattern: 'crosshatch',
      label: 'Suspended',
    },
  },

  critical_infrastructure: {
    school: {
      fillColor: '#9370DB',
      strokeColor: '#6A4FB0',
      strokeWidth: 2,
      opacity: 0.8,
      icon: 'infra-school',
      shape: 'square',
      label: 'School',
    },
    medical: {
      fillColor: '#FF69B4',
      strokeColor: '#CC5490',
      strokeWidth: 2,
      opacity: 0.8,
      icon: 'infra-medical',
      shape: 'circle',
      label: 'Medical Facility',
    },
    utility: {
      fillColor: '#FFD700',
      strokeColor: '#B8960F',
      strokeWidth: 2,
      opacity: 0.8,
      icon: 'infra-utility',
      shape: 'diamond',
      label: 'Utility Corridor',
    },
    damaged: {
      fillColor: '#A52A2A',
      strokeColor: '#7A1F1F',
      strokeWidth: 3,
      opacity: 0.8,
      icon: 'infra-damaged',
      shape: 'triangle',
      label: 'Damaged Structure',
    },
    building: {
      fillColor: '#708090',
      strokeColor: '#4F5F6F',
      strokeWidth: 2,
      opacity: 0.7,
      icon: 'infra-building',
      shape: 'star',
      label: 'Building',
    },
    // UNOSAT satellite-derived damage assessment grades (real, non-synthetic source)
    destroyed: {
      fillColor: '#4A0000',
      strokeColor: '#2A0000',
      strokeWidth: 2,
      opacity: 0.95,
      icon: 'damage-destroyed',
      shape: 'triangle',
      label: 'Destroyed (UNOSAT)',
    },
    severe_damage: {
      fillColor: '#B22222',
      strokeColor: '#7A1717',
      strokeWidth: 2,
      opacity: 0.9,
      icon: 'damage-severe',
      shape: 'triangle',
      label: 'Severe Damage (UNOSAT)',
    },
    moderate_damage: {
      fillColor: '#E08A2E',
      strokeColor: '#A5621C',
      strokeWidth: 2,
      opacity: 0.85,
      icon: 'damage-moderate',
      shape: 'triangle',
      label: 'Moderate Damage (UNOSAT)',
    },
    possible_damage: {
      fillColor: '#E8C547',
      strokeColor: '#B89A2E',
      strokeWidth: 2,
      opacity: 0.75,
      icon: 'damage-possible',
      shape: 'triangle',
      label: 'Possible Damage (UNOSAT)',
    },
  },
};

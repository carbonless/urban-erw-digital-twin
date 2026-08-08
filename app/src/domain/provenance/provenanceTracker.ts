import type { ProvenanceRecord, SensitivityLevel } from '../models/types';

// ─── Source Classification ─────────────────────────────────────────────────

export type SourceClassification =
  | 'category_a_synthetic'
  | 'category_a_public'
  | 'category_b_restricted'
  | 'category_c_rejected';

export interface SourceMetadata {
  sourceId: string;
  classification: SourceClassification;
  description?: string;
}

// ─── Provenance Creation ───────────────────────────────────────────────────

export interface CreateProvenanceInput {
  sourceId: string;
  sensitivityLevel?: SensitivityLevel;
  transformationSteps?: string[];
}

/**
 * Creates a ProvenanceRecord for a feature at ingestion time.
 *
 * Records:
 * - sourceId: identifier of the data source
 * - ingestionTimestamp: when the feature was ingested (now)
 * - transformationSteps: processing steps applied (parsing, validation, mapping, etc.)
 * - sensitivityLevel: classification of the data source
 *
 * @param input Source metadata and optional transformation info
 * @returns A complete ProvenanceRecord
 */
export function createProvenanceRecord(input: CreateProvenanceInput): ProvenanceRecord {
  return {
    sourceId: input.sourceId,
    ingestionTimestamp: new Date(),
    transformationSteps: input.transformationSteps ?? [],
    sensitivityLevel: input.sensitivityLevel ?? 'unclassified',
  };
}

/**
 * Adds a transformation step to an existing provenance record.
 * Returns a new record (immutable).
 */
export function addTransformationStep(
  record: ProvenanceRecord,
  step: string,
): ProvenanceRecord {
  return {
    ...record,
    transformationSteps: [...record.transformationSteps, step],
  };
}

// ─── Source Classification Logic ───────────────────────────────────────────

/**
 * Classifies a data source based on its metadata.
 *
 * Category A (Synthetic): Generated demonstration data (isSynthetic=true)
 * Category A (Public): Openly available government/public datasets
 * Category B (Restricted): Operational data requiring access control
 * Category C (Rejected): Untrusted/unauthorized sources — rejected at ingestion
 */
export function classifySource(metadata: SourceMetadata): SensitivityLevel | 'category_c_rejected' {
  return metadata.classification === 'category_c_rejected'
    ? 'category_c_rejected'
    : metadata.classification as SensitivityLevel;
}

/**
 * Determines whether a source should be accepted for ingestion.
 * Category C sources are rejected with a security warning.
 */
export function isSourceAccepted(metadata: SourceMetadata): boolean {
  return metadata.classification !== 'category_c_rejected';
}

// ─── Provenance Display Helpers ────────────────────────────────────────────

/**
 * Formats provenance for Feature Inspector display.
 * Returns "Provenance unavailable" when the record is missing.
 */
export function formatProvenanceDisplay(
  record: ProvenanceRecord | undefined,
): ProvenanceDisplayData {
  if (!record) {
    return { available: false, message: 'Provenance unavailable' };
  }

  return {
    available: true,
    sourceId: record.sourceId,
    ingestionTimestamp: record.ingestionTimestamp.toISOString(),
    transformationSteps: record.transformationSteps,
    sensitivityLevel: record.sensitivityLevel === 'unclassified'
      ? 'Unclassified'
      : formatSensitivityLabel(record.sensitivityLevel),
  };
}

export interface ProvenanceDisplayData {
  available: boolean;
  message?: string;
  sourceId?: string;
  ingestionTimestamp?: string;
  transformationSteps?: string[];
  sensitivityLevel?: string;
}

function formatSensitivityLabel(level: SensitivityLevel | 'unclassified'): string {
  switch (level) {
    case 'category_a_synthetic':
      return 'Category A (Synthetic)';
    case 'category_a_public':
      return 'Category A (Public)';
    case 'category_b_restricted':
      return 'Category B (Restricted)';
    default:
      return 'Unclassified';
  }
}

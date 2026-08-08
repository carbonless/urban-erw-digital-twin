import { z } from 'zod';

// ─── Validation Result ─────────────────────────────────────────────────────

export interface ValidationFailure {
  featureIndex: number;
  field: string;
  reason: string;
}

export interface ValidationResult {
  valid: boolean;
  failures: ValidationFailure[];
}

// ─── Shared Schemas ────────────────────────────────────────────────────────

/** ISO 8601 date string that can be coerced to a Date */
const iso8601DateSchema = z
  .string()
  .refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Must be a valid ISO 8601 date string' },
  );

/** Status enum values recognized for each feature type */
const hazardStatusSchema = z.enum([
  'suspected', 'confirmed', 'restricted', 'surveyed', 'cleared',
]);

const routeStatusSchema = z.enum([
  'primary', 'restricted', 'blocked', 'reopened',
]);

const clearanceTaskStatusSchema = z.enum([
  'planned', 'in_progress', 'completed', 'suspended',
]);

const evidenceTypeSchema = z.enum([
  'direct_evidence', 'indirect_evidence', 'victim_report',
  'informant_testimony', 'technical_survey_finding',
]);

const sensitivityLevelSchema = z.enum([
  'category_a_synthetic', 'category_a_public', 'category_b_restricted',
]);

/** All recognized status values across feature types */
const recognizedStatusSchema = z.union([
  hazardStatusSchema,
  routeStatusSchema,
  clearanceTaskStatusSchema,
  z.string().min(1),
]);

// ─── Feature Property Schemas ──────────────────────────────────────────────

/** Status history entry within feature properties */
const statusHistoryEntrySchema = z.object({
  effectiveTime: iso8601DateSchema,
  previousStatus: z.string(),
  newStatus: z.string(),
  source: z.string(),
  confidence: z.number().min(0).max(1),
});

/** Provenance record within feature properties */
const provenanceRecordSchema = z.object({
  sourceId: z.string().min(1),
  ingestionTimestamp: iso8601DateSchema,
  transformationSteps: z.array(z.string()),
  sensitivityLevel: sensitivityLevelSchema.or(z.literal('unclassified')).optional(),
});

/**
 * Base feature properties schema.
 * Validates the properties object of a GeoJSON feature for domain ingestion.
 */
export const featurePropertiesSchema = z.object({
  id: z.string().min(1, 'Feature must have a non-empty id'),
  featureType: z.string().min(1, 'Feature must have a featureType'),
  name: z.string().optional(),
  status: recognizedStatusSchema,
  validFrom: iso8601DateSchema.optional(),
  validTo: iso8601DateSchema.optional(),
  responsibleOrganization: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  sensitivityLevel: sensitivityLevelSchema.optional(),
  statusHistory: z.array(statusHistoryEntrySchema).optional().default([]),
  provenance: provenanceRecordSchema.optional(),
  isSynthetic: z.boolean().optional().default(false),
  sourceIdentifier: z.string().optional(),
  // Feature-type-specific optional fields
  evidenceType: evidenceTypeSchema.or(z.string()).optional(),
  description: z.string().optional(),
  routeIdentifier: z.string().optional(),
  infrastructureType: z.string().optional(),
}).passthrough(); // preserve unmapped properties

/**
 * Validates an array of feature property objects (from GeoJSON features).
 * Returns a structured ValidationResult with per-feature failure details.
 */
export function validateFeatureProperties(
  features: unknown[],
): ValidationResult {
  const failures: ValidationFailure[] = [];

  for (let i = 0; i < features.length; i++) {
    const feature = features[i];

    // Check that it's an object
    if (typeof feature !== 'object' || feature === null) {
      failures.push({
        featureIndex: i,
        field: '(root)',
        reason: 'Feature properties must be a non-null object',
      });
      continue;
    }

    const result = featurePropertiesSchema.safeParse(feature);
    if (!result.success) {
      for (const issue of result.error.issues) {
        failures.push({
          featureIndex: i,
          field: issue.path.join('.') || '(root)',
          reason: issue.message,
        });
      }
    }
  }

  return {
    valid: failures.length === 0,
    failures,
  };
}

// Export sub-schemas for reuse
export {
  hazardStatusSchema,
  routeStatusSchema,
  clearanceTaskStatusSchema,
  evidenceTypeSchema,
  sensitivityLevelSchema,
  statusHistoryEntrySchema,
  provenanceRecordSchema,
  iso8601DateSchema,
};

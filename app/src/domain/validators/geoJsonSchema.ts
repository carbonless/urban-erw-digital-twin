import { z } from 'zod';
import { featurePropertiesSchema, type ValidationFailure, type ValidationResult } from './featureSchema';

// ─── RFC 7946 GeoJSON Geometry Schemas ─────────────────────────────────────

/** A position is [longitude, latitude] or [longitude, latitude, altitude] */
const positionSchema = z
  .array(z.number())
  .refine(
    (arr) => arr.length >= 2 && arr.length <= 3,
    { message: 'Position must have 2 or 3 elements [longitude, latitude, altitude?]' },
  );

/** Linear ring: array of positions, first and last position must be the same */
const linearRingSchema = z
  .array(positionSchema)
  .refine(
    (ring) => ring.length >= 4,
    { message: 'Linear ring must have at least 4 positions (closed)' },
  );

const pointGeometrySchema = z.object({
  type: z.literal('Point'),
  coordinates: positionSchema,
});

const multiPointGeometrySchema = z.object({
  type: z.literal('MultiPoint'),
  coordinates: z.array(positionSchema),
});

const lineStringGeometrySchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(positionSchema).min(2, 'LineString must have at least 2 positions'),
});

const multiLineStringGeometrySchema = z.object({
  type: z.literal('MultiLineString'),
  coordinates: z.array(z.array(positionSchema).min(2)),
});

const polygonGeometrySchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(linearRingSchema).min(1, 'Polygon must have at least one ring'),
});

const multiPolygonGeometrySchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(z.array(linearRingSchema).min(1)),
});

/** Discriminated union of all supported GeoJSON geometry types */
const geometrySchema = z.discriminatedUnion('type', [
  pointGeometrySchema,
  multiPointGeometrySchema,
  lineStringGeometrySchema,
  multiLineStringGeometrySchema,
  polygonGeometrySchema,
  multiPolygonGeometrySchema,
]);

// ─── GeoJSON Feature Schema ───────────────────────────────────────────────

const geoJsonFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: geometrySchema,
  properties: z.record(z.unknown()).nullable(),
  id: z.union([z.string(), z.number()]).optional(),
});

// ─── GeoJSON FeatureCollection Schema ──────────────────────────────────────

const geoJsonFeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(z.unknown()),
});

// ─── Validation Functions ──────────────────────────────────────────────────

export interface GeoJsonValidationResult extends ValidationResult {
  /** Indices of features that passed both structure and property validation */
  validIndices: number[];
  /** Indices of features that failed validation */
  invalidIndices: number[];
}

/**
 * Validates a GeoJSON FeatureCollection per RFC 7946.
 *
 * Checks:
 * 1. Top-level structure is a valid FeatureCollection
 * 2. Each feature has valid geometry type (Point, LineString, Polygon, Multi*)
 * 3. Each feature's properties pass domain feature validation
 *
 * Returns structured results with per-feature failure details and
 * indices of valid/invalid features for downstream processing.
 */
export function validateGeoJsonFeatureCollection(data: unknown): GeoJsonValidationResult {
  const failures: ValidationFailure[] = [];
  const validIndices: number[] = [];
  const invalidIndices: number[] = [];

  // Step 1: Validate top-level structure
  const collectionResult = geoJsonFeatureCollectionSchema.safeParse(data);
  if (!collectionResult.success) {
    for (const issue of collectionResult.error.issues) {
      failures.push({
        featureIndex: -1,
        field: issue.path.join('.') || 'type',
        reason: issue.message,
      });
    }
    return { valid: false, failures, validIndices: [], invalidIndices: [] };
  }

  const features = collectionResult.data.features;

  // Step 2 & 3: Validate each feature's geometry and properties
  for (let i = 0; i < features.length; i++) {
    const feature = features[i];
    let featureValid = true;

    // Validate feature structure (type, geometry)
    const featureResult = geoJsonFeatureSchema.safeParse(feature);
    if (!featureResult.success) {
      featureValid = false;
      for (const issue of featureResult.error.issues) {
        failures.push({
          featureIndex: i,
          field: issue.path.join('.') || 'geometry',
          reason: issue.message,
        });
      }
    }

    // Validate properties (domain model fields)
    if (featureResult.success && featureResult.data.properties) {
      const propsResult = featurePropertiesSchema.safeParse(featureResult.data.properties);
      if (!propsResult.success) {
        featureValid = false;
        for (const issue of propsResult.error.issues) {
          failures.push({
            featureIndex: i,
            field: `properties.${issue.path.join('.')}`,
            reason: issue.message,
          });
        }
      }
    } else if (featureResult.success && featureResult.data.properties === null) {
      featureValid = false;
      failures.push({
        featureIndex: i,
        field: 'properties',
        reason: 'Feature properties must not be null for domain ingestion',
      });
    }

    if (featureValid) {
      validIndices.push(i);
    } else {
      invalidIndices.push(i);
    }
  }

  return {
    valid: failures.length === 0,
    failures,
    validIndices,
    invalidIndices,
  };
}

// Export schemas for reuse
export {
  geometrySchema,
  geoJsonFeatureSchema,
  geoJsonFeatureCollectionSchema,
  positionSchema,
  pointGeometrySchema,
  lineStringGeometrySchema,
  polygonGeometrySchema,
  multiPointGeometrySchema,
  multiLineStringGeometrySchema,
  multiPolygonGeometrySchema,
};

import type { DomainFeature, Geometry, GeoPoint, GeoLineString, GeoPolygon, GeoPosition } from '../../domain/models';
import { validateGeoJsonFeatureCollection } from '../../domain/validators';
import { mapFields, type FieldMappingConfig } from '../../domain/mapping';
import { createProvenanceRecord, type SourceClassification } from '../../domain/provenance';
import { deduplicateFeatures } from './deduplicateFeatures';
import { checkSourceHealth, type SourceHealthResult } from './checkSourceHealth';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface GeoJsonLoadResult {
  features: DomainFeature[];
  warnings: string[];
  sourceHealth: SourceHealthResult;
}

export interface GeoJsonLoaderOptions {
  sourceId: string;
  sourceClassification: SourceClassification;
  fieldMapping?: FieldMappingConfig;
  logger?: (message: string) => void;
}

// ─── Geometry Conversion ───────────────────────────────────────────────────

function positionToGeoPosition(coords: number[]): GeoPosition {
  return {
    longitude: coords[0],
    latitude: coords[1],
    altitude: coords.length > 2 ? coords[2] : undefined,
  };
}

function convertGeometry(geojsonGeometry: { type: string; coordinates: unknown }): Geometry | null {
  const { type, coordinates } = geojsonGeometry;

  switch (type) {
    case 'Point': {
      const coords = coordinates as number[];
      return {
        type: 'Point',
        coordinates: positionToGeoPosition(coords),
      } as GeoPoint;
    }
    case 'MultiPoint': {
      // Treat MultiPoint as first point for simplicity
      const points = coordinates as number[][];
      if (points.length === 0) return null;
      return {
        type: 'Point',
        coordinates: positionToGeoPosition(points[0]),
      } as GeoPoint;
    }
    case 'LineString': {
      const coords = coordinates as number[][];
      return {
        type: 'LineString',
        coordinates: coords.map(positionToGeoPosition),
      } as GeoLineString;
    }
    case 'MultiLineString': {
      // Treat as first line string
      const lines = coordinates as number[][][];
      if (lines.length === 0) return null;
      return {
        type: 'LineString',
        coordinates: lines[0].map(positionToGeoPosition),
      } as GeoLineString;
    }
    case 'Polygon': {
      const rings = coordinates as number[][][];
      return {
        type: 'Polygon',
        coordinates: rings.map((ring) => ring.map(positionToGeoPosition)),
      } as GeoPolygon;
    }
    case 'MultiPolygon': {
      // Treat as first polygon
      const polygons = coordinates as number[][][][];
      if (polygons.length === 0) return null;
      return {
        type: 'Polygon',
        coordinates: polygons[0].map((ring) => ring.map(positionToGeoPosition)),
      } as GeoPolygon;
    }
    default:
      return null;
  }
}

// ─── Feature Conversion ────────────────────────────────────────────────────

function convertToDomainFeature(
  rawFeature: { geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> },
  options: GeoJsonLoaderOptions,
): DomainFeature | null {
  const geometry = convertGeometry(rawFeature.geometry);
  if (!geometry) return null;

  // Apply field mapping if configured
  let properties: Record<string, unknown>;
  let unmappedProperties: Record<string, unknown>;

  if (options.fieldMapping) {
    const mapResult = mapFields(rawFeature.properties, options.fieldMapping);
    properties = mapResult.mapped;
    unmappedProperties = mapResult.unmapped;
  } else {
    properties = { ...rawFeature.properties };
    unmappedProperties = {};
  }

  // Extract core fields
  const id = String(properties.id ?? rawFeature.properties.id ?? '');
  const featureType = String(properties.featureType ?? rawFeature.properties.featureType ?? 'unknown');
  const status = String(properties.status ?? rawFeature.properties.status ?? 'unknown');

  if (!id) return null;

  // Build provenance record
  const provenance = createProvenanceRecord({
    sourceId: options.sourceId,
    sensitivityLevel: options.sourceClassification === 'category_c_rejected'
      ? undefined
      : options.sourceClassification,
    transformationSteps: ['geojson_parse', 'validation', 'field_mapping', 'deduplication'],
  });

  // Parse dates
  const validFrom = properties.validFrom ? new Date(String(properties.validFrom)) : undefined;
  const validTo = properties.validTo ? new Date(String(properties.validTo)) : undefined;

  // Parse status history
  const rawHistory = (properties.statusHistory ?? rawFeature.properties.statusHistory) as
    | Array<{ effectiveTime: string; previousStatus: string; newStatus: string; source: string; confidence: number }>
    | undefined;

  const statusHistory = (rawHistory ?? []).map((entry) => ({
    effectiveTime: new Date(entry.effectiveTime),
    previousStatus: entry.previousStatus,
    newStatus: entry.newStatus,
    source: entry.source,
    confidence: entry.confidence ?? 1.0,
  }));

  // Confidence
  const confidence = properties.confidence !== undefined
    ? Number(properties.confidence)
    : undefined;

  // Build base feature
  const base = {
    id,
    featureType,
    name: properties.name ? String(properties.name) : undefined,
    status,
    validFrom: validFrom && !isNaN(validFrom.getTime()) ? validFrom : undefined,
    validTo: validTo && !isNaN(validTo.getTime()) ? validTo : undefined,
    responsibleOrganization: properties.responsibleOrganization
      ? String(properties.responsibleOrganization)
      : undefined,
    confidence: confidence !== undefined && !isNaN(confidence) ? confidence : undefined,
    sensitivityLevel: (properties.sensitivityLevel as DomainFeature['sensitivityLevel']) ?? undefined,
    statusHistory,
    provenance,
    unmappedProperties,
    isSynthetic: Boolean(properties.isSynthetic ?? rawFeature.properties.isSynthetic ?? false),
    sourceIdentifier: properties.sourceIdentifier
      ? String(properties.sourceIdentifier)
      : undefined,
    geometry,
  };

  // Return typed feature based on featureType
  switch (featureType) {
    case 'hazard_area':
      return { ...base, featureType: 'hazard_area', geometry: geometry as GeoPolygon } as DomainFeature;
    case 'evidence_point':
      return {
        ...base,
        featureType: 'evidence_point',
        evidenceType: String(properties.evidenceType ?? 'direct_evidence'),
        description: properties.description ? String(properties.description) : undefined,
        geometry: geometry as GeoPoint,
      } as DomainFeature;
    case 'clearance_task':
      return { ...base, featureType: 'clearance_task', geometry: geometry as GeoPolygon } as DomainFeature;
    case 'route':
      return {
        ...base,
        featureType: 'route',
        routeIdentifier: properties.routeIdentifier ? String(properties.routeIdentifier) : undefined,
        geometry: geometry as GeoLineString,
      } as DomainFeature;
    case 'critical_infrastructure':
      return {
        ...base,
        featureType: 'critical_infrastructure',
        infrastructureType: String(properties.infrastructureType ?? 'building'),
        geometry: geometry as (GeoPoint | GeoPolygon),
      } as DomainFeature;
    default:
      // Treat unknown feature types as hazard_area with polygon or critical_infrastructure
      if (geometry.type === 'Polygon') {
        return { ...base, featureType: 'hazard_area', geometry: geometry as GeoPolygon } as DomainFeature;
      }
      if (geometry.type === 'Point') {
        return {
          ...base,
          featureType: 'critical_infrastructure',
          infrastructureType: 'unknown',
          geometry: geometry as GeoPoint,
        } as DomainFeature;
      }
      if (geometry.type === 'LineString') {
        return { ...base, featureType: 'route', geometry: geometry as GeoLineString } as DomainFeature;
      }
      return null;
  }
}

// ─── Main Loader ───────────────────────────────────────────────────────────

/**
 * Loads and processes a GeoJSON FeatureCollection into domain features.
 *
 * Pipeline:
 * 1. Validate RFC 7946 structure and per-feature properties
 * 2. Skip invalid features with warning log
 * 3. Apply field mapping (if configured)
 * 4. Deduplicate by feature ID (retain most recent)
 * 5. Attach provenance records
 * 6. Check source health (warn if >50% invalid)
 *
 * @param data Raw GeoJSON data (parsed JSON)
 * @param options Loader configuration
 * @returns GeoJsonLoadResult with features, warnings, and health status
 */
export function loadGeoJson(
  data: unknown,
  options: GeoJsonLoaderOptions,
): GeoJsonLoadResult {
  const logger = options.logger ?? console.warn;
  const warnings: string[] = [];

  // Step 1: Validate GeoJSON structure
  const validation = validateGeoJsonFeatureCollection(data);

  if (!validation.valid && validation.validIndices.length === 0) {
    // Total failure — can't extract any features
    const msgs = validation.failures.map(
      (f) => `Feature ${f.featureIndex}, field "${f.field}": ${f.reason}`,
    );
    warnings.push(...msgs);

    const sourceHealth = checkSourceHealth(
      options.sourceId,
      validation.failures.length > 0 ? 1 : 0,
      validation.failures.length > 0 ? 1 : 0,
      logger,
    );

    return { features: [], warnings, sourceHealth };
  }

  // Log invalid features
  for (const failure of validation.failures) {
    const msg = `[GeoJsonLoader] Skipping feature ${failure.featureIndex}: ` +
      `field "${failure.field}" — ${failure.reason}`;
    warnings.push(msg);
    logger(msg);
  }

  // Step 2: Extract valid features from raw data
  const rawFeatures = (data as { features: unknown[] }).features;
  const validRawFeatures = validation.validIndices.map((i) => rawFeatures[i] as {
    geometry: { type: string; coordinates: unknown };
    properties: Record<string, unknown>;
  });

  // Step 3: Convert to domain features
  const domainFeatures: DomainFeature[] = [];
  for (const raw of validRawFeatures) {
    const feature = convertToDomainFeature(raw, options);
    if (feature) {
      domainFeatures.push(feature);
    }
  }

  // Step 4: Deduplicate
  const deduplicated = deduplicateFeatures(domainFeatures, (msg) => {
    warnings.push(msg);
    logger(msg);
  });

  // Step 5: Check source health
  const totalFeatures = rawFeatures.length;
  const invalidCount = validation.invalidIndices.length;
  const sourceHealth = checkSourceHealth(options.sourceId, totalFeatures, invalidCount, logger);

  return {
    features: deduplicated,
    warnings,
    sourceHealth,
  };
}

/**
 * Fetches and loads a GeoJSON file from a URL.
 */
export async function fetchAndLoadGeoJson(
  url: string,
  options: GeoJsonLoaderOptions,
): Promise<GeoJsonLoadResult> {
  const logger = options.logger ?? console.warn;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const msg = `[GeoJsonLoader] Failed to fetch ${url}: HTTP ${response.status}`;
      logger(msg);
      return {
        features: [],
        warnings: [msg],
        sourceHealth: { sourceId: options.sourceId, totalFeatures: 0, validFeatures: 0, invalidFeatures: 0, failureRate: 0, healthy: true },
      };
    }

    const data = await response.json() as unknown;
    return loadGeoJson(data, options);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const msg = `[GeoJsonLoader] Error loading ${url}: ${reason}`;
    logger(msg);
    return {
      features: [],
      warnings: [msg],
      sourceHealth: { sourceId: options.sourceId, totalFeatures: 0, validFeatures: 0, invalidFeatures: 0, failureRate: 0, healthy: true },
    };
  }
}

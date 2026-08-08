import type { DomainFeature, GeoPoint, GeoPolygon, GeoLineString, StatusHistoryEntry } from '../../domain/models';
import { createProvenanceRecord, type SourceClassification } from '../../domain/provenance';

// ─── CZML Types ────────────────────────────────────────────────────────────

/**
 * A CZML packet — minimal typing for the fields we consume.
 * Full CZML spec is complex; we extract what's needed for the domain model.
 */
export interface CzmlPacket {
  id: string;
  name?: string;
  description?: string;
  availability?: string; // ISO 8601 interval "start/end"
  position?: {
    cartographicDegrees?: number[]; // [lon, lat, alt] or time-tagged
  };
  polyline?: {
    positions?: {
      cartographicDegrees?: number[];
    };
  };
  polygon?: {
    positions?: {
      cartographicDegrees?: number[];
    };
  };
  properties?: Record<string, unknown>;
}

export interface CzmlLoadResult {
  features: DomainFeature[];
  warnings: string[];
  /** Raw CZML packets for CesiumJS CzmlDataSource consumption */
  rawPackets: CzmlPacket[];
}

export interface CzmlLoaderOptions {
  sourceId: string;
  sourceClassification: SourceClassification;
  logger?: (message: string) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseAvailability(availability: string | undefined): { validFrom?: Date; validTo?: Date } {
  if (!availability) return {};
  const parts = availability.split('/');
  if (parts.length !== 2) return {};

  const start = new Date(parts[0]);
  const end = new Date(parts[1]);
  return {
    validFrom: isNaN(start.getTime()) ? undefined : start,
    validTo: isNaN(end.getTime()) ? undefined : end,
  };
}

function extractPointGeometry(packet: CzmlPacket): GeoPoint | null {
  const coords = packet.position?.cartographicDegrees;
  if (!coords || coords.length < 3) return null;

  // Handle time-tagged positions: [time, lon, lat, alt, time, lon, lat, alt, ...]
  // vs simple positions: [lon, lat, alt]
  if (coords.length === 3) {
    return {
      type: 'Point',
      coordinates: { longitude: coords[0], latitude: coords[1], altitude: coords[2] },
    };
  }

  // Time-tagged: use first position
  if (coords.length >= 4 && typeof coords[0] === 'number') {
    // If first element looks like a large number (epoch) or we have multiples of 4
    if (coords.length % 4 === 0) {
      return {
        type: 'Point',
        coordinates: { longitude: coords[1], latitude: coords[2], altitude: coords[3] },
      };
    }
    // Otherwise treat as [lon, lat, alt, ...]
    return {
      type: 'Point',
      coordinates: { longitude: coords[0], latitude: coords[1], altitude: coords[2] },
    };
  }

  return null;
}

function extractLineGeometry(packet: CzmlPacket): GeoLineString | null {
  const coords = packet.polyline?.positions?.cartographicDegrees;
  if (!coords || coords.length < 6) return null; // At least 2 points (lon,lat,alt × 2)

  const positions = [];
  for (let i = 0; i < coords.length; i += 3) {
    positions.push({
      longitude: coords[i],
      latitude: coords[i + 1],
      altitude: coords[i + 2],
    });
  }

  return { type: 'LineString', coordinates: positions };
}

function extractPolygonGeometry(packet: CzmlPacket): GeoPolygon | null {
  const coords = packet.polygon?.positions?.cartographicDegrees;
  if (!coords || coords.length < 9) return null; // At least 3 points

  const ring = [];
  for (let i = 0; i < coords.length; i += 3) {
    ring.push({
      longitude: coords[i],
      latitude: coords[i + 1],
      altitude: coords[i + 2],
    });
  }

  return { type: 'Polygon', coordinates: [ring] };
}

// ─── Main Loader ───────────────────────────────────────────────────────────

/**
 * Loads CZML packets and converts them to domain features.
 *
 * CZML is CesiumJS's native time-dynamic format. This loader:
 * 1. Parses CZML packets (skipping the document packet at index 0)
 * 2. Extracts geometry (point, polyline, polygon)
 * 3. Parses availability intervals for time-based visibility
 * 4. Converts properties to domain model fields
 * 5. Preserves raw packets for CesiumJS CzmlDataSource native handling
 *
 * @param data Raw CZML data (parsed JSON array of packets)
 * @param options Loader configuration
 * @returns CzmlLoadResult with domain features and raw packets
 */
export function loadCzml(
  data: unknown,
  options: CzmlLoaderOptions,
): CzmlLoadResult {
  const logger = options.logger ?? console.warn;
  const warnings: string[] = [];

  if (!Array.isArray(data)) {
    const msg = '[CzmlLoader] CZML data must be an array of packets';
    warnings.push(msg);
    logger(msg);
    return { features: [], warnings, rawPackets: [] };
  }

  const packets = data as CzmlPacket[];
  const rawPackets: CzmlPacket[] = [];
  const features: DomainFeature[] = [];

  for (let i = 0; i < packets.length; i++) {
    const packet = packets[i];

    // Skip document packet (first packet with id "document")
    if (packet.id === 'document' || (i === 0 && !packet.position && !packet.polyline && !packet.polygon)) {
      rawPackets.push(packet);
      continue;
    }

    rawPackets.push(packet);

    // Try to extract geometry
    let geometry: GeoPoint | GeoLineString | GeoPolygon | null = null;
    let featureType: string = 'critical_infrastructure';

    geometry = extractPointGeometry(packet);
    if (geometry) {
      featureType = 'evidence_point';
    }

    if (!geometry) {
      geometry = extractLineGeometry(packet);
      if (geometry) featureType = 'route';
    }

    if (!geometry) {
      geometry = extractPolygonGeometry(packet);
      if (geometry) featureType = 'hazard_area';
    }

    if (!geometry) {
      const msg = `[CzmlLoader] Skipping packet ${i} (id: "${packet.id}"): no recognizable geometry`;
      warnings.push(msg);
      logger(msg);
      continue;
    }

    // Extract properties
    const props = packet.properties ?? {};
    const { validFrom, validTo } = parseAvailability(packet.availability);

    // Parse status history from properties
    const rawHistory = (props.statusHistory ?? []) as Array<{
      effectiveTime: string;
      previousStatus: string;
      newStatus: string;
      source: string;
      confidence: number;
    }>;

    const statusHistory: StatusHistoryEntry[] = rawHistory.map((entry) => ({
      effectiveTime: new Date(entry.effectiveTime),
      previousStatus: entry.previousStatus,
      newStatus: entry.newStatus,
      source: entry.source,
      confidence: entry.confidence ?? 1.0,
    }));

    const provenance = createProvenanceRecord({
      sourceId: options.sourceId,
      sensitivityLevel: options.sourceClassification === 'category_c_rejected'
        ? undefined
        : options.sourceClassification,
      transformationSteps: ['czml_parse', 'geometry_extraction', 'property_mapping'],
    });

    // Determine featureType from properties if available
    const resolvedFeatureType = String(props.featureType ?? featureType);
    const status = String(props.status ?? 'unknown');

    const base = {
      id: packet.id,
      featureType: resolvedFeatureType,
      name: packet.name,
      status,
      validFrom,
      validTo,
      responsibleOrganization: props.responsibleOrganization ? String(props.responsibleOrganization) : undefined,
      confidence: props.confidence !== undefined ? Number(props.confidence) : undefined,
      sensitivityLevel: (props.sensitivityLevel as DomainFeature['sensitivityLevel']) ?? undefined,
      statusHistory,
      provenance,
      unmappedProperties: props as Record<string, unknown>,
      isSynthetic: Boolean(props.isSynthetic ?? false),
      sourceIdentifier: props.sourceIdentifier ? String(props.sourceIdentifier) : undefined,
    };

    // Build typed feature
    switch (resolvedFeatureType) {
      case 'hazard_area':
        features.push({ ...base, featureType: 'hazard_area', geometry: geometry as GeoPolygon } as DomainFeature);
        break;
      case 'evidence_point':
        features.push({
          ...base,
          featureType: 'evidence_point',
          evidenceType: String(props.evidenceType ?? 'direct_evidence'),
          description: props.description ? String(props.description) : undefined,
          geometry: geometry as GeoPoint,
        } as DomainFeature);
        break;
      case 'clearance_task':
        features.push({ ...base, featureType: 'clearance_task', geometry: geometry as GeoPolygon } as DomainFeature);
        break;
      case 'route':
        features.push({
          ...base,
          featureType: 'route',
          routeIdentifier: props.routeIdentifier ? String(props.routeIdentifier) : undefined,
          geometry: geometry as GeoLineString,
        } as DomainFeature);
        break;
      case 'critical_infrastructure':
        features.push({
          ...base,
          featureType: 'critical_infrastructure',
          infrastructureType: String(props.infrastructureType ?? 'building'),
          geometry: geometry as (GeoPoint | GeoPolygon),
        } as DomainFeature);
        break;
      default:
        // Default based on geometry type
        if (geometry.type === 'Polygon') {
          features.push({ ...base, featureType: 'hazard_area', geometry: geometry as GeoPolygon } as DomainFeature);
        } else if (geometry.type === 'Point') {
          features.push({
            ...base,
            featureType: 'critical_infrastructure',
            infrastructureType: 'unknown',
            geometry: geometry as GeoPoint,
          } as DomainFeature);
        } else {
          features.push({ ...base, featureType: 'route', geometry: geometry as GeoLineString } as DomainFeature);
        }
    }
  }

  return { features, warnings, rawPackets };
}

/**
 * Fetches and loads a CZML file from a URL.
 */
export async function fetchAndLoadCzml(
  url: string,
  options: CzmlLoaderOptions,
): Promise<CzmlLoadResult> {
  const logger = options.logger ?? console.warn;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const msg = `[CzmlLoader] Failed to fetch ${url}: HTTP ${response.status}`;
      logger(msg);
      return { features: [], warnings: [msg], rawPackets: [] };
    }

    const data = await response.json() as unknown;
    return loadCzml(data, options);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const msg = `[CzmlLoader] Error loading ${url}: ${reason}`;
    logger(msg);
    return { features: [], warnings: [msg], rawPackets: [] };
  }
}

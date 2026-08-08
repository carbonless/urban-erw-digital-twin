// ─── Core Type Unions (Enums) ──────────────────────────────────────────────

/** Status lifecycle for Hazard Areas */
export type HazardStatus =
  | 'suspected'
  | 'confirmed'
  | 'restricted'
  | 'surveyed'
  | 'cleared';

/** Status lifecycle for Routes */
export type RouteStatus =
  | 'primary'
  | 'restricted'
  | 'blocked'
  | 'reopened';

/** Classification of evidence collected during survey */
export type EvidenceType =
  | 'direct_evidence'
  | 'indirect_evidence'
  | 'victim_report'
  | 'informant_testimony'
  | 'technical_survey_finding';

/** Data sensitivity classification */
export type SensitivityLevel =
  | 'category_a_synthetic'
  | 'category_a_public'
  | 'category_b_restricted';

/** Phases of the operational scenario timeline */
export type ScenarioPhase =
  | 'initial_state'
  | 'survey'
  | 'clearance'
  | 'post_clearance';

/** Status lifecycle for Clearance Tasks */
export type ClearanceTaskStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'suspended';

// ─── Geometry Types ────────────────────────────────────────────────────────

/** A geographic position in degrees and optional altitude */
export interface GeoPosition {
  longitude: number; // degrees
  latitude: number; // degrees
  altitude?: number; // meters above ellipsoid
}

/** A polygon geometry with outer ring and optional holes */
export interface GeoPolygon {
  type: 'Polygon';
  coordinates: GeoPosition[][]; // outer ring + optional holes
}

/** A line string geometry */
export interface GeoLineString {
  type: 'LineString';
  coordinates: GeoPosition[];
}

/** A point geometry */
export interface GeoPoint {
  type: 'Point';
  coordinates: GeoPosition;
}

/** Discriminated union of supported geometry types */
export type Geometry = GeoPolygon | GeoLineString | GeoPoint;

// ─── Status History ────────────────────────────────────────────────────────

/** A single entry in a feature's status change history */
export interface StatusHistoryEntry {
  effectiveTime: Date;
  previousStatus: string;
  newStatus: string;
  source: string;
  confidence: number; // 0.0 – 1.0
}

// ─── Provenance ────────────────────────────────────────────────────────────

/** Records the lineage and transformation history of a feature */
export interface ProvenanceRecord {
  sourceId: string;
  ingestionTimestamp: Date;
  transformationSteps: string[];
  sensitivityLevel: SensitivityLevel | 'unclassified';
}

// ─── Base Feature ──────────────────────────────────────────────────────────

/** Common fields shared by all domain feature types */
export interface BaseFeature {
  id: string;
  featureType: string;
  name?: string;
  status: string;
  validFrom?: Date;
  validTo?: Date;
  responsibleOrganization?: string;
  confidence?: number; // 0.0 – 1.0
  sensitivityLevel?: SensitivityLevel;
  statusHistory: StatusHistoryEntry[];
  provenance?: ProvenanceRecord;
  unmappedProperties: Record<string, unknown>;
  isSynthetic: boolean;
  sourceIdentifier?: string; // original ArcGIS ObjectID/GlobalID
}

// ─── Concrete Feature Types ───────────────────────────────────────────────

/** A polygon representing a suspected, confirmed, restricted, surveyed, or cleared area */
export interface HazardArea extends BaseFeature {
  featureType: 'hazard_area';
  status: HazardStatus | string; // allows unrecognized for graceful degradation
  geometry: GeoPolygon;
}

/** A point feature representing survey evidence, reports, or observations */
export interface EvidencePoint extends BaseFeature {
  featureType: 'evidence_point';
  evidenceType: EvidenceType | string;
  description?: string;
  geometry: GeoPoint;
}

/** A polygon representing an assigned clearance operation */
export interface ClearanceTask extends BaseFeature {
  featureType: 'clearance_task';
  status: ClearanceTaskStatus | string;
  geometry: GeoPolygon;
}

/** A line feature representing primary, restricted, blocked, or reopened movement corridors */
export interface Route extends BaseFeature {
  featureType: 'route';
  status: RouteStatus | string;
  routeIdentifier?: string;
  geometry: GeoLineString;
}

/** A point or polygon representing schools, medical facilities, utility corridors, etc. */
export interface CriticalInfrastructure extends BaseFeature {
  featureType: 'critical_infrastructure';
  infrastructureType: string; // school, medical, utility, etc.
  geometry: GeoPoint | GeoPolygon;
}

// ─── Discriminated Union ───────────────────────────────────────────────────

/** Discriminated union of all concrete domain feature types */
export type DomainFeature =
  | HazardArea
  | EvidencePoint
  | ClearanceTask
  | Route
  | CriticalInfrastructure;

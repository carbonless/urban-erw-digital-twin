// Zod validation schemas for data ingestion
export {
  featurePropertiesSchema,
  validateFeatureProperties,
  hazardStatusSchema,
  routeStatusSchema,
  clearanceTaskStatusSchema,
  evidenceTypeSchema,
  sensitivityLevelSchema,
  statusHistoryEntrySchema,
  provenanceRecordSchema,
  iso8601DateSchema,
} from './featureSchema';

export type { ValidationFailure, ValidationResult } from './featureSchema';

export {
  validateGeoJsonFeatureCollection,
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
} from './geoJsonSchema';

export type { GeoJsonValidationResult } from './geoJsonSchema';

import type { DomainFeature } from '../../domain/models';
import type { FieldMappingConfig } from '../../domain/mapping';
import { loadGeoJson, type GeoJsonLoaderOptions } from '../loaders/geoJsonLoader';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ArcGISAdapterOptions {
  featureServiceUrl: string;
  fieldMapping: FieldMappingConfig;
  sourceId?: string;
  timeoutMs?: number;
  pageSize?: number;
  logger?: (message: string) => void;
}

export interface ArcGISLoadResult {
  features: DomainFeature[];
  warnings: string[];
  fromCache: boolean;
}

// ─── Cached Data ───────────────────────────────────────────────────────────

let cachedFeatures: DomainFeature[] = [];

// ─── Main Adapter ──────────────────────────────────────────────────────────

/**
 * Queries an ArcGIS Feature Service with f=geojson, paginating via resultOffset.
 *
 * Features:
 * - Queries with `f=geojson` to get GeoJSON-formatted responses
 * - Paginates using `resultOffset` and `resultRecordCount`
 * - Maps ArcGIS fields to domain model using field mapping config
 * - Preserves original ObjectID/GlobalID in `sourceIdentifier`
 * - Implements timeout handling (default 10s) with fallback to cached data
 * - Handles authentication/authorization errors with non-blocking notification
 *
 * @param options Adapter configuration
 * @returns ArcGISLoadResult with features and warnings
 */
export async function queryArcGISFeatureService(
  options: ArcGISAdapterOptions,
): Promise<ArcGISLoadResult> {
  const {
    featureServiceUrl,
    fieldMapping,
    sourceId = 'arcgis',
    timeoutMs = 10000,
    pageSize = 1000,
    logger = console.warn,
  } = options;

  const warnings: string[] = [];
  const allFeatures: DomainFeature[] = [];
  let offset = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const url = buildQueryUrl(featureServiceUrl, offset, pageSize);

      // Fetch with timeout
      const response = await fetchWithTimeout(url, timeoutMs);

      if (!response.ok) {
        // Check for auth errors
        if (response.status === 401 || response.status === 403) {
          const msg = `[ArcGIS] Authentication/authorization error (HTTP ${response.status}). ` +
            `Using cached data if available.`;
          warnings.push(msg);
          logger(msg);
          return fallbackToCache(warnings);
        }

        const msg = `[ArcGIS] HTTP ${response.status} from ${url}`;
        warnings.push(msg);
        logger(msg);
        return fallbackToCache(warnings);
      }

      const data = await response.json() as unknown;

      // ArcGIS may return an error object instead of features
      if (isArcGISError(data)) {
        const errorMsg = extractArcGISError(data);
        const msg = `[ArcGIS] Service error: ${errorMsg}`;
        warnings.push(msg);
        logger(msg);
        return fallbackToCache(warnings);
      }

      // Use the GeoJSON loader pipeline to process features
      const loaderOptions: GeoJsonLoaderOptions = {
        sourceId,
        sourceClassification: 'category_a_public',
        fieldMapping,
        logger,
      };

      const result = loadGeoJson(data, loaderOptions);
      warnings.push(...result.warnings);

      // Preserve ObjectID/GlobalID as sourceIdentifier
      const featuresWithSourceId = result.features.map((f) => ({
        ...f,
        sourceIdentifier: f.sourceIdentifier ?? f.unmappedProperties.OBJECTID as string
          ?? f.unmappedProperties.GlobalID as string
          ?? f.unmappedProperties.objectid as string
          ?? undefined,
      }));

      allFeatures.push(...(featuresWithSourceId as DomainFeature[]));

      // Check if there are more pages
      const featureCollection = data as { features?: unknown[] };
      const returnedCount = featureCollection.features?.length ?? 0;
      hasMore = returnedCount >= pageSize;
      offset += pageSize;
    }

    // Update cache
    cachedFeatures = allFeatures;

    return { features: allFeatures, warnings, fromCache: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    if (reason.includes('timeout') || reason.includes('AbortError')) {
      const msg = `[ArcGIS] Request timed out after ${timeoutMs}ms. Using cached data.`;
      warnings.push(msg);
      logger(msg);
    } else {
      const msg = `[ArcGIS] Network error: ${reason}. Using cached data.`;
      warnings.push(msg);
      logger(msg);
    }

    return fallbackToCache(warnings);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildQueryUrl(baseUrl: string, offset: number, pageSize: number): string {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}f=geojson&where=1%3D1&outFields=*&resultOffset=${offset}&resultRecordCount=${pageSize}`;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('timeout');
    }
    throw error;
  }
}

function fallbackToCache(warnings: string[]): ArcGISLoadResult {
  if (cachedFeatures.length > 0) {
    warnings.push(`[ArcGIS] Falling back to ${cachedFeatures.length} cached features.`);
    return { features: [...cachedFeatures], warnings, fromCache: true };
  }
  warnings.push('[ArcGIS] No cached data available.');
  return { features: [], warnings, fromCache: true };
}

function isArcGISError(data: unknown): boolean {
  return typeof data === 'object' && data !== null && 'error' in data;
}

function extractArcGISError(data: unknown): string {
  const errorObj = (data as { error?: { message?: string; code?: number } }).error;
  if (errorObj) {
    return `${errorObj.code ?? 'unknown'}: ${errorObj.message ?? 'Unknown error'}`;
  }
  return 'Unknown ArcGIS error';
}

/**
 * Clears the internal feature cache. Useful for testing.
 */
export function clearArcGISCache(): void {
  cachedFeatures = [];
}

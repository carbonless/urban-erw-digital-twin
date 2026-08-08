/**
 * Field Mapper — maps raw feature properties to domain model fields
 * using a runtime-loadable field mapping configuration.
 *
 * Preserves unmapped properties in a separate record for Feature Inspector display.
 */

export interface FieldMappingEntry {
  /** Source property name in raw data */
  source: string;
  /** Target domain model field name */
  target: string;
  /** Optional transform to apply during mapping */
  transform?: 'string' | 'number' | 'boolean' | 'date' | 'json';
}

export interface FieldMappingConfig {
  /** Human-readable name for this mapping configuration */
  name: string;
  /** Source identifier (e.g., 'geojson', 'arcgis') */
  sourceType: string;
  /** Ordered list of field mappings */
  mappings: FieldMappingEntry[];
}

export interface MapFieldsResult {
  /** Properties that matched a mapping entry and were transformed */
  mapped: Record<string, unknown>;
  /** Properties that had no mapping entry — preserved for inspection */
  unmapped: Record<string, unknown>;
}

/**
 * Applies a transform to a raw value based on the specified type.
 */
function applyTransform(value: unknown, transform?: string): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  switch (transform) {
    case 'string':
      return String(value);
    case 'number': {
      const num = Number(value);
      return isNaN(num) ? value : num;
    }
    case 'boolean':
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1';
      }
      return Boolean(value);
    case 'date':
      if (typeof value === 'string' || typeof value === 'number') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? value : d.toISOString();
      }
      return value;
    case 'json':
      if (typeof value === 'string') {
        try {
          return JSON.parse(value) as unknown;
        } catch {
          return value;
        }
      }
      return value;
    default:
      return value;
  }
}

/**
 * Maps raw properties through a field mapping configuration.
 *
 * - For each mapping entry, if the source field exists in rawProperties,
 *   it is placed into `mapped` under the target key (with optional transform).
 * - Any source fields not covered by a mapping entry end up in `unmapped`.
 * - If a source field is mapped, it is removed from unmapped consideration.
 *
 * @param rawProperties The raw properties object from the data source
 * @param config The field mapping configuration to apply
 * @returns { mapped, unmapped } — partitioned property sets
 */
export function mapFields(
  rawProperties: Record<string, unknown>,
  config: FieldMappingConfig,
): MapFieldsResult {
  const mapped: Record<string, unknown> = {};
  const mappedSourceKeys = new Set<string>();

  for (const entry of config.mappings) {
    const { source, target, transform } = entry;

    if (source in rawProperties) {
      mapped[target] = applyTransform(rawProperties[source], transform);
      mappedSourceKeys.add(source);
    }
  }

  // Collect unmapped properties
  const unmapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawProperties)) {
    if (!mappedSourceKeys.has(key)) {
      unmapped[key] = value;
    }
  }

  return { mapped, unmapped };
}

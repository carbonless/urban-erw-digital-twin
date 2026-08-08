import type { DomainFeature } from '../../domain/models';

/**
 * Deduplicates features by ID, retaining the feature with the most recent
 * `validFrom` date when duplicates are detected. Logs duplicate occurrences
 * with both timestamps.
 *
 * @param features Array of domain features (potentially with duplicate IDs)
 * @param logger Optional logger for duplicate warnings (defaults to console.warn)
 * @returns Deduplicated array of features
 */
export function deduplicateFeatures(
  features: DomainFeature[],
  logger: (message: string) => void = console.warn,
): DomainFeature[] {
  const featureMap = new Map<string, DomainFeature>();

  for (const feature of features) {
    const existing = featureMap.get(feature.id);

    if (!existing) {
      featureMap.set(feature.id, feature);
      continue;
    }

    // Resolve by most recent validFrom (or lastUpdated via validFrom)
    const existingTime = existing.validFrom?.getTime() ?? 0;
    const newTime = feature.validFrom?.getTime() ?? 0;

    if (newTime > existingTime) {
      logger(
        `[Deduplicator] Duplicate feature ID "${feature.id}": ` +
        `retaining newer (${feature.validFrom?.toISOString() ?? 'no date'}) ` +
        `over older (${existing.validFrom?.toISOString() ?? 'no date'})`,
      );
      featureMap.set(feature.id, feature);
    } else {
      logger(
        `[Deduplicator] Duplicate feature ID "${feature.id}": ` +
        `retaining existing (${existing.validFrom?.toISOString() ?? 'no date'}) ` +
        `over newer attempt (${feature.validFrom?.toISOString() ?? 'no date'})`,
      );
    }
  }

  return Array.from(featureMap.values());
}

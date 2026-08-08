/**
 * Source health check — emits a warning when >50% of features from a source
 * fail validation. This indicates a systemic issue with the data source.
 */

export interface SourceHealthResult {
  sourceId: string;
  totalFeatures: number;
  validFeatures: number;
  invalidFeatures: number;
  failureRate: number;
  healthy: boolean;
}

/**
 * Checks the health of a data source by evaluating the ratio of
 * invalid features to total features.
 *
 * Emits a source-level warning when more than 50% of features fail validation.
 *
 * @param sourceId Identifier of the data source being checked
 * @param totalFeatures Total number of features attempted
 * @param invalidFeatures Number of features that failed validation
 * @param logger Logger function for warnings (defaults to console.warn)
 * @returns SourceHealthResult with health status
 */
export function checkSourceHealth(
  sourceId: string,
  totalFeatures: number,
  invalidFeatures: number,
  logger: (message: string) => void = console.warn,
): SourceHealthResult {
  const validFeatures = totalFeatures - invalidFeatures;
  const failureRate = totalFeatures > 0 ? invalidFeatures / totalFeatures : 0;
  const healthy = failureRate <= 0.5;

  if (!healthy) {
    logger(
      `[SourceHealth] WARNING: Source "${sourceId}" has ${invalidFeatures}/${totalFeatures} ` +
      `(${(failureRate * 100).toFixed(1)}%) failed features. ` +
      `This exceeds the 50% threshold — source may be unreliable.`,
    );
  }

  return {
    sourceId,
    totalFeatures,
    validFeatures,
    invalidFeatures,
    failureRate,
    healthy,
  };
}

import { DEFAULT_STYLE_CONFIG, type FeatureStyle, type StyleConfig } from './styleConfig';

/**
 * Default fallback style used when no matching style is found
 * for a given feature type + status combination.
 */
const DEFAULT_FALLBACK_STYLE: FeatureStyle = {
  fillColor: '#808080',
  strokeColor: '#606060',
  strokeWidth: 1,
  opacity: 0.5,
  pattern: 'solid',
  label: 'Unknown',
};

/**
 * Resolves the visual style for a feature given its type and status.
 *
 * Lookup order:
 * 1. Exact match in config[featureType][status]
 * 2. Fall back to the default style with the status as label
 *
 * @param featureType The domain feature type (e.g., 'hazard_area', 'route')
 * @param status The current status or sub-type (e.g., 'confirmed', 'blocked')
 * @param config Optional custom style config; defaults to DEFAULT_STYLE_CONFIG
 * @returns The resolved FeatureStyle
 */
export function resolveStyle(
  featureType: string,
  status: string,
  config: StyleConfig = DEFAULT_STYLE_CONFIG,
): FeatureStyle {
  const typeStyles = config[featureType];
  if (!typeStyles) {
    return { ...DEFAULT_FALLBACK_STYLE, label: status };
  }

  const style = typeStyles[status];
  if (!style) {
    return { ...DEFAULT_FALLBACK_STYLE, label: status };
  }

  return style;
}

/**
 * Returns all defined styles for a given feature type.
 * Useful for building legend entries.
 */
export function getStylesForFeatureType(
  featureType: string,
  config: StyleConfig = DEFAULT_STYLE_CONFIG,
): Record<string, FeatureStyle> {
  return config[featureType] ?? {};
}

/**
 * Returns all feature types that have style definitions.
 */
export function getStyledFeatureTypes(
  config: StyleConfig = DEFAULT_STYLE_CONFIG,
): string[] {
  return Object.keys(config);
}

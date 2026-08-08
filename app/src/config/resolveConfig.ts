import { appConfigSchema, REQUIRED_CONFIG_KEYS, type AppConfig } from './configSchema';

/**
 * Maps AppConfig keys to their corresponding VITE_ environment variable names.
 */
const ENV_KEY_MAP: Record<string, string> = {
  cesiumIonToken: 'VITE_CESIUM_ION_TOKEN',
  urbanContextProvider: 'VITE_URBAN_CONTEXT_PROVIDER',
  dataServiceEndpoints: 'VITE_DATA_SERVICE_ENDPOINTS',
  arcgisFeatureServiceUrl: 'VITE_ARCGIS_FEATURE_SERVICE_URL',
  arcgisFieldMapping: 'VITE_ARCGIS_FIELD_MAPPING',
  environment: 'VITE_ENVIRONMENT',
  demoMode: 'VITE_DEMO_MODE',
  defaultCameraPosition: 'VITE_DEFAULT_CAMERA_POSITION',
  scenarioTimeRange: 'VITE_SCENARIO_TIME_RANGE',
};

export interface ConfigError {
  type: 'missing_keys' | 'validation_error';
  message: string;
  missingKeys?: string[];
}

export type ConfigResult =
  | { ok: true; config: AppConfig }
  | { ok: false; error: ConfigError };

/**
 * Parses env var string values into their appropriate types for AppConfig.
 */
function parseEnvValue(key: string, value: string): unknown {
  switch (key) {
    case 'demoMode':
      return value.toLowerCase() === 'true';
    case 'dataServiceEndpoints':
      try {
        return JSON.parse(value) as unknown;
      } catch {
        // Support comma-separated fallback
        return value.split(',').map((s) => s.trim());
      }
    case 'defaultCameraPosition':
      return JSON.parse(value) as unknown;
    case 'scenarioTimeRange':
      return JSON.parse(value) as unknown;
    default:
      return value;
  }
}

/**
 * Reads configuration values from Vite environment variables (import.meta.env).
 * Returns a partial config object with only the keys that are present.
 */
export function readEnvVars(env: Record<string, string | undefined>): Partial<Record<string, unknown>> {
  const result: Partial<Record<string, unknown>> = {};

  for (const [configKey, envKey] of Object.entries(ENV_KEY_MAP)) {
    const value = env[envKey];
    if (value !== undefined && value !== '') {
      result[configKey] = parseEnvValue(configKey, value);
    }
  }

  return result;
}

/**
 * Resolves configuration by merging env vars over file config.
 * Env vars take precedence over file config when both are present.
 *
 * Returns a ConfigResult indicating success with validated AppConfig,
 * or failure with detailed error information.
 */
export function resolveConfig(
  envVars: Partial<Record<string, unknown>>,
  fileConfig: Partial<Record<string, unknown>> | null,
): ConfigResult {
  // Merge: env vars take precedence over file config
  const merged: Record<string, unknown> = {};

  // Start with file config as base
  if (fileConfig) {
    for (const [key, value] of Object.entries(fileConfig)) {
      if (value !== undefined) {
        merged[key] = value;
      }
    }
  }

  // Overlay env vars (precedence)
  for (const [key, value] of Object.entries(envVars)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }

  // Check for missing required keys before validation
  const missingKeys = REQUIRED_CONFIG_KEYS.filter(
    (key) => merged[key] === undefined || merged[key] === null || merged[key] === '',
  );

  if (missingKeys.length > 0) {
    return {
      ok: false,
      error: {
        type: 'missing_keys',
        message: `Missing required configuration keys: ${missingKeys.join(', ')}`,
        missingKeys: [...missingKeys],
      },
    };
  }

  // Validate with Zod schema
  const parseResult = appConfigSchema.safeParse(merged);

  if (!parseResult.success) {
    const issues = parseResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    return {
      ok: false,
      error: {
        type: 'validation_error',
        message: `Configuration validation failed: ${issues.join('; ')}`,
      },
    };
  }

  return { ok: true, config: parseResult.data };
}

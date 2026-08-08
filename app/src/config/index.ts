import { readEnvVars, resolveConfig, type ConfigResult } from './resolveConfig';
export type { AppConfig, CameraPosition } from './configSchema';
export { appConfigSchema, cameraPositionSchema, REQUIRED_CONFIG_KEYS } from './configSchema';
export type { ConfigResult, ConfigError } from './resolveConfig';
export { resolveConfig, readEnvVars } from './resolveConfig';

/**
 * Default path to the optional JSON configuration file.
 * In Vite projects, files in /public are served at the root.
 */
const CONFIG_FILE_PATH = '/config.json';

/**
 * Loads the optional JSON configuration file.
 * Returns null if the file doesn't exist (404).
 * Throws a descriptive error if the file is malformed.
 */
async function loadConfigFile(path: string): Promise<Partial<Record<string, unknown>> | null> {
  try {
    const response = await fetch(path);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.warn(
        `[ConfigManager] Config file at "${path}" returned status ${response.status}. Falling back to env-only.`,
      );
      return null;
    }

    const text = await response.text();

    try {
      return JSON.parse(text) as Partial<Record<string, unknown>>;
    } catch (parseError) {
      const reason = parseError instanceof Error ? parseError.message : String(parseError);
      console.error(
        `[ConfigManager] Malformed config file at "${path}": ${reason}. Falling back to env-only.`,
      );
      return null;
    }
  } catch (networkError) {
    const reason = networkError instanceof Error ? networkError.message : String(networkError);
    console.warn(
      `[ConfigManager] Unable to fetch config file at "${path}": ${reason}. Falling back to env-only.`,
    );
    return null;
  }
}

/**
 * Loads and resolves the application configuration.
 *
 * Resolution order:
 * 1. Read environment variables (VITE_* prefixed via import.meta.env)
 * 2. Optionally load JSON config file at /config.json
 * 3. Env vars take precedence over file config when both present
 * 4. If required keys are missing, return error listing exactly the missing key names
 * 5. If config file is malformed, log error and fall back to env-only
 *
 * @returns ConfigResult — either { ok: true, config } or { ok: false, error }
 */
export async function loadConfig(): Promise<ConfigResult> {
  // Read env vars from Vite's import.meta.env
  const env = import.meta.env as Record<string, string | undefined>;
  const envVars = readEnvVars(env);

  // Attempt to load optional config file
  const fileConfig = await loadConfigFile(CONFIG_FILE_PATH);

  // Resolve with precedence: env > file
  return resolveConfig(envVars, fileConfig);
}

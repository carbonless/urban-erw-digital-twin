import { z } from 'zod';
import type { FieldMappingConfig } from './fieldMapper';

// ─── Schema for validating field mapping configuration files ───────────────

const fieldMappingEntrySchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  transform: z.enum(['string', 'number', 'boolean', 'date', 'json']).optional(),
});

const fieldMappingConfigSchema = z.object({
  name: z.string().min(1),
  sourceType: z.string().min(1),
  mappings: z.array(fieldMappingEntrySchema).min(1, 'At least one mapping entry is required'),
});

export interface FieldMappingConfigLoadResult {
  ok: boolean;
  config?: FieldMappingConfig;
  error?: string;
}

/**
 * Parses and validates a field mapping configuration object.
 * Used for both JSON file loading and inline configuration.
 */
export function parseFieldMappingConfig(data: unknown): FieldMappingConfigLoadResult {
  const result = fieldMappingConfigSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    return { ok: false, error: `Invalid field mapping config: ${issues.join('; ')}` };
  }
  return { ok: true, config: result.data };
}

/**
 * Loads a field mapping configuration from a URL (typically /public/data/*.json).
 * Returns the parsed config or an error message.
 */
export async function loadFieldMappingConfig(url: string): Promise<FieldMappingConfigLoadResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { ok: false, error: `Failed to load field mapping config from ${url}: HTTP ${response.status}` };
    }

    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      const reason = parseError instanceof Error ? parseError.message : String(parseError);
      return { ok: false, error: `Malformed JSON in field mapping config at ${url}: ${reason}` };
    }

    return parseFieldMappingConfig(data);
  } catch (networkError) {
    const reason = networkError instanceof Error ? networkError.message : String(networkError);
    return { ok: false, error: `Network error loading field mapping config from ${url}: ${reason}` };
  }
}

export { fieldMappingConfigSchema };

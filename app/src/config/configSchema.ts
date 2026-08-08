import { z } from 'zod';

/**
 * Camera position schema for default viewer positioning.
 */
export const cameraPositionSchema = z.object({
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  altitude: z.number(),
  heading: z.number(),
  pitch: z.number(),
  roll: z.number(),
});

export type CameraPosition = z.infer<typeof cameraPositionSchema>;

/**
 * Full application configuration schema.
 * Required fields: cesiumIonToken, urbanContextProvider, dataServiceEndpoints (≥1),
 * environment, demoMode, defaultCameraPosition, scenarioTimeRange.
 */
export const appConfigSchema = z.object({
  cesiumIonToken: z.string().min(1, 'cesiumIonToken must be a non-empty string'),
  urbanContextProvider: z.enum(['cesium-world-terrain', 'google-3d-tiles']),
  dataServiceEndpoints: z.array(z.string().url()).min(1, 'At least one data service endpoint is required'),
  arcgisFeatureServiceUrl: z.string().url().optional(),
  arcgisFieldMapping: z.string().optional(),
  environment: z.string().min(1, 'environment must be a non-empty string'),
  demoMode: z.boolean(),
  defaultCameraPosition: cameraPositionSchema,
  scenarioTimeRange: z.object({
    start: z.coerce.date(),
    end: z.coerce.date(),
  }).refine(
    (range) => range.start < range.end,
    { message: 'scenarioTimeRange.start must be before scenarioTimeRange.end' },
  ),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

/**
 * The set of required configuration keys. If any of these are missing,
 * initialization is blocked with an error listing the missing keys.
 */
export const REQUIRED_CONFIG_KEYS = [
  'cesiumIonToken',
  'urbanContextProvider',
  'dataServiceEndpoints',
  'environment',
  'demoMode',
  'defaultCameraPosition',
  'scenarioTimeRange',
] as const;

export type RequiredConfigKey = (typeof REQUIRED_CONFIG_KEYS)[number];

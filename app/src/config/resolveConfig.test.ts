import { describe, it, expect } from 'vitest';
import { resolveConfig, readEnvVars } from './resolveConfig';

describe('resolveConfig', () => {
  const validFileConfig = {
    cesiumIonToken: 'test-token-123',
    urbanContextProvider: 'cesium-world-terrain',
    dataServiceEndpoints: ['https://example.com/data'],
    environment: 'development',
    demoMode: true,
    defaultCameraPosition: {
      longitude: 44.4,
      latitude: 33.3,
      altitude: 1000,
      heading: 0,
      pitch: -45,
      roll: 0,
    },
    scenarioTimeRange: {
      start: '2024-01-01T00:00:00Z',
      end: '2024-06-01T00:00:00Z',
    },
  };

  it('resolves a fully valid file config with no env vars', () => {
    const result = resolveConfig({}, validFileConfig);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.cesiumIonToken).toBe('test-token-123');
      expect(result.config.urbanContextProvider).toBe('cesium-world-terrain');
      expect(result.config.demoMode).toBe(true);
    }
  });

  it('env vars take precedence over file config', () => {
    const envVars = { cesiumIonToken: 'env-token-override' };
    const result = resolveConfig(envVars, validFileConfig);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.cesiumIonToken).toBe('env-token-override');
    }
  });

  it('returns missing keys error when required keys are absent', () => {
    const result = resolveConfig({}, null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('missing_keys');
      expect(result.error.missingKeys).toContain('cesiumIonToken');
      expect(result.error.missingKeys).toContain('urbanContextProvider');
      expect(result.error.missingKeys).toContain('dataServiceEndpoints');
      expect(result.error.missingKeys).toContain('environment');
      expect(result.error.missingKeys).toContain('demoMode');
      expect(result.error.missingKeys).toContain('defaultCameraPosition');
      expect(result.error.missingKeys).toContain('scenarioTimeRange');
    }
  });

  it('lists only the specific missing keys', () => {
    const partialConfig = {
      cesiumIonToken: 'token',
      urbanContextProvider: 'cesium-world-terrain',
      dataServiceEndpoints: ['https://example.com/api'],
      environment: 'production',
      // demoMode, defaultCameraPosition, scenarioTimeRange are missing
    };
    const result = resolveConfig({}, partialConfig);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('missing_keys');
      expect(result.error.missingKeys).toEqual(
        expect.arrayContaining(['demoMode', 'defaultCameraPosition', 'scenarioTimeRange']),
      );
      expect(result.error.missingKeys).not.toContain('cesiumIonToken');
      expect(result.error.missingKeys).not.toContain('urbanContextProvider');
    }
  });

  it('returns validation error for invalid urbanContextProvider', () => {
    const invalidConfig = {
      ...validFileConfig,
      urbanContextProvider: 'invalid-provider',
    };
    const result = resolveConfig({}, invalidConfig);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('validation_error');
    }
  });

  it('returns validation error for empty dataServiceEndpoints', () => {
    const invalidConfig = {
      ...validFileConfig,
      dataServiceEndpoints: [],
    };
    const result = resolveConfig({}, invalidConfig);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('validation_error');
    }
  });

  it('accepts optional arcgisFeatureServiceUrl', () => {
    const configWithArcgis = {
      ...validFileConfig,
      arcgisFeatureServiceUrl: 'https://arcgis.example.com/featureserver',
    };
    const result = resolveConfig({}, configWithArcgis);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.arcgisFeatureServiceUrl).toBe('https://arcgis.example.com/featureserver');
    }
  });

  it('handles null file config (file not found) with env vars only', () => {
    const envVars = {
      cesiumIonToken: 'env-token',
      urbanContextProvider: 'google-3d-tiles',
      dataServiceEndpoints: ['https://data.example.com'],
      environment: 'staging',
      demoMode: false,
      defaultCameraPosition: {
        longitude: 0,
        latitude: 0,
        altitude: 500,
        heading: 0,
        pitch: -90,
        roll: 0,
      },
      scenarioTimeRange: {
        start: '2024-03-01T00:00:00Z',
        end: '2024-09-01T00:00:00Z',
      },
    };
    const result = resolveConfig(envVars, null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.cesiumIonToken).toBe('env-token');
      expect(result.config.urbanContextProvider).toBe('google-3d-tiles');
    }
  });
});

describe('readEnvVars', () => {
  it('maps VITE_CESIUM_ION_TOKEN to cesiumIonToken', () => {
    const env = { VITE_CESIUM_ION_TOKEN: 'my-token' };
    const result = readEnvVars(env);
    expect(result.cesiumIonToken).toBe('my-token');
  });

  it('parses VITE_DEMO_MODE as boolean', () => {
    const env = { VITE_DEMO_MODE: 'true' };
    const result = readEnvVars(env);
    expect(result.demoMode).toBe(true);
  });

  it('parses VITE_DEMO_MODE false as boolean', () => {
    const env = { VITE_DEMO_MODE: 'false' };
    const result = readEnvVars(env);
    expect(result.demoMode).toBe(false);
  });

  it('parses VITE_DATA_SERVICE_ENDPOINTS as JSON array', () => {
    const env = { VITE_DATA_SERVICE_ENDPOINTS: '["https://a.com","https://b.com"]' };
    const result = readEnvVars(env);
    expect(result.dataServiceEndpoints).toEqual(['https://a.com', 'https://b.com']);
  });

  it('parses VITE_DATA_SERVICE_ENDPOINTS as comma-separated fallback', () => {
    const env = { VITE_DATA_SERVICE_ENDPOINTS: 'https://a.com, https://b.com' };
    const result = readEnvVars(env);
    expect(result.dataServiceEndpoints).toEqual(['https://a.com', 'https://b.com']);
  });

  it('parses VITE_DEFAULT_CAMERA_POSITION as JSON object', () => {
    const pos = { longitude: 1, latitude: 2, altitude: 3, heading: 4, pitch: 5, roll: 6 };
    const env = { VITE_DEFAULT_CAMERA_POSITION: JSON.stringify(pos) };
    const result = readEnvVars(env);
    expect(result.defaultCameraPosition).toEqual(pos);
  });

  it('ignores empty string env vars', () => {
    const env = { VITE_CESIUM_ION_TOKEN: '' };
    const result = readEnvVars(env);
    expect(result.cesiumIonToken).toBeUndefined();
  });

  it('ignores undefined env vars', () => {
    const env = { VITE_CESIUM_ION_TOKEN: undefined };
    const result = readEnvVars(env);
    expect(result.cesiumIonToken).toBeUndefined();
  });
});

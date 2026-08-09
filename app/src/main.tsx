import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Viewer, Cesium3DTileset, CameraFlyTo, useCesium } from 'resium';
import { Ion, IonResource, Cartesian3, Math as CesiumMath, createWorldTerrainAsync, type TerrainProvider } from 'cesium';
import { loadConfig, type AppConfig } from '@config';
import { loadGeoJson } from '@adapters/loaders/geoJsonLoader';
import { addFeaturesToViewer, updateLayerVisibility, type RenderedEntity } from '@adapters/cesium/cesiumAdapter';
import { useAppStore } from '@state/store';

const OSM_BUILDINGS_ASSET_ID = 96188;
const DEMO_DATA_URL = '/data/demo-scenario.geojson';

const LAYER_LABELS: Record<string, string> = {
  hazard_area: 'Hazard Areas',
  route: 'Routes',
  evidence_point: 'Evidence Points',
};

// Loads the synthetic demo dataset into the viewer once mounted, and keeps
// entity visibility in sync with the Zustand layerVisibility state.
function SceneContent() {
  const { viewer } = useCesium();
  const renderedRef = useRef<RenderedEntity[]>([]);
  const layerVisibility = useAppStore((s) => s.layerVisibility);

  useEffect(() => {
    if (!viewer) return;
    let cancelled = false;

    fetch(DEMO_DATA_URL)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const result = loadGeoJson(data, {
          sourceId: 'demo-scenario',
          sourceClassification: 'category_a_synthetic',
        });
        renderedRef.current = addFeaturesToViewer(result.features, { viewer });
        updateLayerVisibility(renderedRef.current, useAppStore.getState().layerVisibility);
      })
      .catch((err) => console.error('[SceneContent] Failed to load demo data:', err));

    return () => {
      cancelled = true;
    };
  }, [viewer]);

  useEffect(() => {
    updateLayerVisibility(renderedRef.current, layerVisibility);
  }, [layerVisibility]);

  return null;
}

function LayerPanel() {
  const layerVisibility = useAppStore((s) => s.layerVisibility);
  const toggleLayer = useAppStore((s) => s.toggleLayer);

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 1000,
        background: 'rgba(20, 24, 22, 0.85)',
        color: '#eee',
        padding: '10px 14px',
        borderRadius: 4,
        fontFamily: 'sans-serif',
        fontSize: 13,
        minWidth: 160,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 11 }}>
        Layers
      </div>
      {Object.entries(LAYER_LABELS).map(([key, label]) => (
        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={layerVisibility[key] ?? true}
            onChange={() => toggleLayer(key)}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terrainProvider, setTerrainProvider] = useState<TerrainProvider | null>(null);

  useEffect(() => {
    loadConfig().then(async (result) => {
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      Ion.defaultAccessToken = result.config.cesiumIonToken;
      // Resolve terrain before mounting the Viewer — mounting with terrain still
      // undefined starts Cesium on the flat default ellipsoid, and swapping the
      // terrain provider in afterward can leave OSM Buildings (positioned at real
      // elevation) visually detached from the ground.
      const terrain = await createWorldTerrainAsync();
      setTerrainProvider(terrain);
      setConfig(result.config);
    });
  }, []);

  if (error) {
    return (
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <h1>Configuration error</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!config || !terrainProvider) {
    return <div style={{ padding: 24, fontFamily: 'sans-serif' }}>Loading terrain…</div>;
  }

  const cam = config.defaultCameraPosition;

  return (
    <Viewer full terrainProvider={terrainProvider}>
      <Cesium3DTileset url={IonResource.fromAssetId(OSM_BUILDINGS_ASSET_ID)} />
      <CameraFlyTo
        destination={Cartesian3.fromDegrees(cam.longitude, cam.latitude, cam.altitude)}
        orientation={{
          heading: CesiumMath.toRadians(cam.heading),
          pitch: CesiumMath.toRadians(cam.pitch),
          roll: CesiumMath.toRadians(cam.roll),
        }}
        once
      />
      <SceneContent />
      <LayerPanel />
    </Viewer>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

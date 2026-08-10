import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Viewer, Cesium3DTileset, CameraFlyTo, Entity, ModelGraphics, useCesium } from 'resium';
import {
  Ion,
  IonResource,
  Cartesian3,
  Math as CesiumMath,
  createWorldTerrainAsync,
  createGooglePhotorealistic3DTileset,
  HeightReference,
  type TerrainProvider,
  type Cesium3DTileset as Cesium3DTilesetType,
} from 'cesium';
import { loadConfig, type AppConfig } from '@config';
import { loadGeoJson } from '@adapters/loaders/geoJsonLoader';
import { addFeaturesToViewer, updateLayerVisibility, type RenderedEntity } from '@adapters/cesium/cesiumAdapter';
import { useAppStore } from '@state/store';

const OSM_BUILDINGS_ASSET_ID = 96188;
const DEMO_DATA_URL = '/data/demo-scenario.geojson';
const UNOSAT_DATA_URL = '/data/unosat-damage.geojson';

const LAYER_LABELS: Record<string, string> = {
  hazard_area: 'Hazard Areas',
  route: 'Routes',
  evidence_point: 'Evidence Points',
  critical_infrastructure: 'Building Damage (UNOSAT)',
};

// Loads the synthetic demo dataset plus the real UNOSAT damage-assessment
// subset into the viewer once mounted, and keeps entity visibility in sync
// with the Zustand layerVisibility state.
function SceneContent() {
  const { viewer } = useCesium();
  const renderedRef = useRef<RenderedEntity[]>([]);
  const layerVisibility = useAppStore((s) => s.layerVisibility);

  useEffect(() => {
    if (!viewer) return;
    let cancelled = false;

    Promise.all([
      fetch(DEMO_DATA_URL).then((res) => res.json()),
      fetch(UNOSAT_DATA_URL).then((res) => res.json()),
    ])
      .then(([demoData, unosatData]) => {
        if (cancelled) return;
        const demoResult = loadGeoJson(demoData, {
          sourceId: 'demo-scenario',
          sourceClassification: 'category_a_synthetic',
        });
        // Real UNOSAT satellite damage assessment — Category A (public), not synthetic.
        // Comprehensive Gaza Strip assessment (04 April 2025), using each site's
        // LATEST classification across up to 12 reassessment passes (Nov 2023 –
        // Apr 2025) rather than the stale baseline field — see report for why
        // that distinction matters (baseline undercounts damage severely).
        const unosatResult = loadGeoJson(unosatData, {
          sourceId: 'unosat-gaza-strip-comprehensive-damage-assessment-04apr2025',
          sourceClassification: 'category_a_public',
        });
        const allFeatures = [...demoResult.features, ...unosatResult.features];
        renderedRef.current = addFeaturesToViewer(allFeatures, { viewer });
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

export type GoogleTilesStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | {
      state: 'loaded';
      tileCount: number;
      geometricError: number;
      tilesWithContentReady: number;
      trianglesSelected: number;
      pendingRequests: number;
    }
  | { state: 'error'; message: string };

// Empirically tests Google Photorealistic 3D Tiles coverage for the current
// area by adding the tileset as a scene primitive when enabled. Goes through
// the existing Cesium Ion token (no separate Google Maps API key configured),
// since createGooglePhotorealistic3DTileset() falls back to a cached Ion
// asset request when no explicit key is provided. Reports status back to the
// UI rather than only logging to console, since "does it actually look 3D"
// turned out to need more than a console check to diagnose.
function GoogleTilesTest({ enabled, onStatusChange }: { enabled: boolean; onStatusChange: (s: GoogleTilesStatus) => void }) {
  const { viewer } = useCesium();
  const tilesetRef = useRef<Cesium3DTilesetType | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!viewer || !enabled) {
      onStatusChange({ state: 'idle' });
      return;
    }
    let cancelled = false;
    onStatusChange({ state: 'loading' });

    createGooglePhotorealistic3DTileset()
      .then((tileset) => {
        if (cancelled) {
          tileset.destroy();
          return;
        }
        viewer.scene.primitives.add(tileset);
        tilesetRef.current = tileset;
        const tileCount = tileset.root?.children?.length ?? -1;
        const geometricError = tileset.root?.geometricError ?? -1;

        // The root loading only confirms the top of Google's WORLDWIDE tileset
        // resolved — that's the same object no matter where the camera is
        // pointed. The real coverage signal is whether actual content tiles
        // stream in for the current view, so poll live statistics as the
        // camera settles rather than trusting the initial load alone.
        const reportStats = () => {
          if (cancelled) return;
          const stats = tileset.statistics;
          onStatusChange({
            state: 'loaded',
            tileCount,
            geometricError,
            tilesWithContentReady: stats.numberOfTilesWithContentReady,
            trianglesSelected: stats.numberOfTrianglesSelected,
            pendingRequests: stats.numberOfPendingRequests,
          });
        };
        reportStats();
        const interval = setInterval(reportStats, 1000);
        intervalRef.current = interval;
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[GoogleTilesTest] Failed to load Google 3D Tiles:', err);
        onStatusChange({ state: 'error', message });
      });

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (tilesetRef.current) {
        viewer.scene.primitives.remove(tilesetRef.current);
        tilesetRef.current = null;
      }
    };
  }, [viewer, enabled]);

  return null;
}

const buttonStyle: React.CSSProperties = {
  background: 'rgba(20, 24, 22, 0.85)',
  color: '#eee',
  border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: 4,
  padding: '6px 10px',
  fontFamily: 'sans-serif',
  fontSize: 12,
  cursor: 'pointer',
};

// Imperative camera presets. Top-down (pitch -90) is what layer toggling was
// tested against — good for reading the map, but flattens any 3D geometry
// (real or fake) into what looks like a plain orthophoto. Oblique offsets the
// eye south of the target and looks forward-and-down at it, so building
// height/relief is actually visible — and, learned from the first camera bug,
// the target has to be offset in FRONT of the eye position, not directly
// underneath it, or it ends up outside the view frustum entirely.
function CameraControls({ target }: { target: { longitude: number; latitude: number } }) {
  const { viewer } = useCesium();

  const flyTopDown = () => {
    if (!viewer) return;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(target.longitude, target.latitude, 900),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-90),
        roll: 0,
      },
      duration: 2,
    });
  };

  const flyOblique = (t: { longitude: number; latitude: number } = target) => {
    if (!viewer) return;
    const standoffDegreesLat = 0.0062; // ~690m south — keeps target in frame at pitch -30, alt 450m
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(t.longitude, t.latitude - standoffDegreesLat, 450),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-30),
        roll: 0,
      },
      duration: 2,
    });
  };

  // Lower Manhattan, NYC — a metro with confirmed strong Photorealistic 3D
  // Tiles coverage, used here purely as a fidelity baseline: same altitude/
  // pitch as the Gaza oblique shot, so triangle counts are directly comparable
  // rather than confounded by different camera geometry.
  const NYC_FINANCIAL_DISTRICT = { longitude: -74.0113, latitude: 40.7074 };
  const flyToNycBaseline = () => flyOblique(NYC_FINANCIAL_DISTRICT);

  const flyToDestructionDemo = () => {
    if (!viewer) return;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        DESTRUCTION_DEMO_LOCATION.longitude,
        DESTRUCTION_DEMO_LOCATION.latitude - 0.0009,
        120,
      ),
      orientation: { heading: CesiumMath.toRadians(0), pitch: CesiumMath.toRadians(-25), roll: 0 },
      duration: 2,
    });
  };

  // Rönesans Rezidans, Antakya/Hatay, Turkey — real coordinates of an 11-story
  // residential tower that toppled in the 2023 Turkey-Syria earthquake
  // (269 deaths), one of the most widely documented single-building
  // collapses from that event. Used here to empirically test Google's
  // Crisis Response earthquake-imagery claim against a specific, real,
  // well-known post-disaster site — the same live-diagnostic approach used
  // for the Gaza/NYC coverage comparison.
  const RONESANS_REZIDANS = { longitude: 36.150046, latitude: 36.230288 };
  const flyToTurkeyQuakeSite = () => flyOblique(RONESANS_REZIDANS);

  // Notre-Dame de Paris — a cleaner test of Google's refresh cadence than the
  // Antakya site: Paris is unambiguously one of the ~2,500 major cities with
  // guaranteed Photorealistic 3D Tiles coverage (unlike Antakya, where an
  // empty result can't be distinguished from "never had coverage at all"),
  // and the April 2019 fire caused precisely-located, well-documented,
  // completely apolitical structural damage (collapsed spire, burned roof
  // frame) — with a full restoration completed and reopened December 2024.
  // Whether the tiles show pre-fire, fire-damaged, or restored state is a
  // real, isolated read on refresh cadence, not confounded by coverage
  // existing at all.
  const NOTRE_DAME = { longitude: 2.349902, latitude: 48.852966 };
  const flyToNotreDame = () => flyOblique(NOTRE_DAME);

  // Beirut Port grain silos — unlike Notre-Dame (actively restored) or
  // Antakya (coverage-status unknown), this is a still-damaged, unrebuilt
  // destruction site in a major capital city, six years after the August
  // 2020 explosion. Sections of the silos have continued collapsing as
  // recently as 2026; reconstruction remains undecided. If Beirut has
  // baseline coverage, this is the cleanest available test of whether
  // Google's tiles reflect PERSISTENT, still-relevant damage rather than a
  // temporary or already-resolved event.
  const BEIRUT_PORT_SILOS = { longitude: 35.525, latitude: 33.90278 };
  const flyToBeirutSilos = () => flyOblique(BEIRUT_PORT_SILOS);

  return (
    <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <button style={buttonStyle} onClick={flyTopDown}>Top-down</button>
      <button style={buttonStyle} onClick={() => flyOblique()}>Oblique view</button>
      <button style={buttonStyle} onClick={flyToNycBaseline}>NYC (coverage baseline)</button>
      <button style={buttonStyle} onClick={flyToDestructionDemo}>Destruction demo (synthetic)</button>
      <button style={buttonStyle} onClick={flyToTurkeyQuakeSite}>Turkey quake site (real, Crisis Response test)</button>
      <button style={buttonStyle} onClick={flyToNotreDame}>Notre-Dame (refresh-cadence test)</button>
      <button style={buttonStyle} onClick={flyToBeirutSilos}>Beirut port silos (persistent damage test)</button>
    </div>
  );
}

// A generic, fictional structure — deliberately NOT the Gaza demo coordinates,
// so it's never confused with the real UNOSAT/hazard data on screen at the
// same time. This exists purely to demonstrate the capability (procedurally
// fractured + physics-simulated "before/after" via Blender, exported as glTF)
// on something with no relationship to any real place or event.
const DESTRUCTION_DEMO_LOCATION = { longitude: 34.4668, latitude: 31.53 }; // ~3km north of the Gaza demo cluster, isolated on its own

function DestructionDemo({ showAfter }: { showAfter: boolean }) {
  const position = Cartesian3.fromDegrees(
    DESTRUCTION_DEMO_LOCATION.longitude,
    DESTRUCTION_DEMO_LOCATION.latitude,
  );
  return (
    <Entity position={position} name="Generic building (synthetic capability demo)">
      <ModelGraphics
        uri={showAfter ? '/models/generic-building-after.glb' : '/models/generic-building-before.glb'}
        heightReference={HeightReference.CLAMP_TO_GROUND}
        scale={1}
      />
    </Entity>
  );
}

function GoogleStatusLine({ status }: { status: GoogleTilesStatus }) {
  if (status.state === 'idle') return null;
  if (status.state === 'loading') {
    return <div style={{ fontSize: 11, color: '#ccc', marginTop: 4 }}>Loading Google tileset…</div>;
  }
  if (status.state === 'error') {
    return <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 4 }}>Failed: {status.message}</div>;
  }
  const hasRealContent = status.trianglesSelected > 0;
  return (
    <div style={{ fontSize: 11, color: hasRealContent ? '#7ee787' : '#e0a72e', marginTop: 4, lineHeight: 1.5 }}>
      Root loaded ({status.tileCount} children) — live: {status.tilesWithContentReady} tiles with content,{' '}
      {status.trianglesSelected.toLocaleString()} triangles selected, {status.pendingRequests} pending
      <br />
      {hasRealContent
        ? 'Real geometry is streaming for this view.'
        : 'No triangles selected yet — no content for this area/zoom, or still loading.'}
    </div>
  );
}

function ControlPanel({
  useGoogleTiles,
  setUseGoogleTiles,
  googleTilesStatus,
  showDestructionAfter,
  setShowDestructionAfter,
}: {
  useGoogleTiles: boolean;
  setUseGoogleTiles: (v: boolean) => void;
  googleTilesStatus: GoogleTilesStatus;
  showDestructionAfter: boolean;
  setShowDestructionAfter: (v: boolean) => void;
}) {
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
        minWidth: 200,
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

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: 8, paddingTop: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 11 }}>
          Basemap (coverage test)
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={useGoogleTiles}
            onChange={(e) => setUseGoogleTiles(e.target.checked)}
          />
          Google Photorealistic 3D Tiles
        </label>
        <GoogleStatusLine status={googleTilesStatus} />
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: 8, paddingTop: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 2, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 11 }}>
          Destruction Demo
        </div>
        <div style={{ fontSize: 10, color: '#e0a72e', marginBottom: 4 }}>
          SYNTHETIC — generic structure, not a real location
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showDestructionAfter}
            onChange={(e) => setShowDestructionAfter(e.target.checked)}
          />
          Show "after" (fractured + simulated collapse)
        </label>
      </div>
    </div>
  );
}

function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terrainProvider, setTerrainProvider] = useState<TerrainProvider | null>(null);
  const [useGoogleTiles, setUseGoogleTiles] = useState(false);
  const [googleTilesStatus, setGoogleTilesStatus] = useState<GoogleTilesStatus>({ state: 'idle' });
  const [showDestructionAfter, setShowDestructionAfter] = useState(false);

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
      <Cesium3DTileset url={IonResource.fromAssetId(OSM_BUILDINGS_ASSET_ID)} show={!useGoogleTiles} />
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
      <GoogleTilesTest enabled={useGoogleTiles} onStatusChange={setGoogleTilesStatus} />
      <DestructionDemo showAfter={showDestructionAfter} />
      <ControlPanel
        useGoogleTiles={useGoogleTiles}
        setUseGoogleTiles={setUseGoogleTiles}
        googleTilesStatus={googleTilesStatus}
        showDestructionAfter={showDestructionAfter}
        setShowDestructionAfter={setShowDestructionAfter}
      />
      <CameraControls target={{ longitude: cam.longitude, latitude: cam.latitude }} />
    </Viewer>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

# Implementation Plan: Urban ERW Digital Twin — Phase 1

## Overview

This plan implements the Urban ERW Digital Twin Phase 1 demonstrator as a layered architecture: Domain Layer (pure TypeScript), Adapter Layer (CesiumJS bridge, ArcGIS client, data loaders), State Layer (Zustand), UI Layer (React + Resium), and Infrastructure (AWS CDK). Tasks are ordered to establish foundations first (project structure, domain model), then adapters and state, then UI components, and finally integration and infrastructure.

## Tasks

- [ ] 1. Set up project structure, tooling, and core configuration
  - [x] 1.1 Initialize Vite + React + TypeScript project with CesiumJS and Resium
    - Create `app/` directory with `package.json` specifying React 18, TypeScript 5, Vite 5, CesiumJS 1.119+, Resium 1.18+, Zustand 4, Zod 3, fast-check, vitest
    - Configure `vite.config.ts` with `vite-plugin-cesium` for static asset handling
    - Set up `tsconfig.json` with strict mode and path aliases for `@domain`, `@adapters`, `@state`, `@components`, `@config`
    - Create the directory structure as defined in the design (domain/, adapters/, state/, components/, config/, hooks/)
    - _Requirements: 1.1, 25.1_

  - [ ] 1.2 Implement Configuration Manager with environment variable and file loading
    - Create `app/src/config/configSchema.ts` with Zod schema for `AppConfig` (cesiumIonToken, urbanContextProvider, dataServiceEndpoints, environment, demoMode, etc.)
    - Create `app/src/config/resolveConfig.ts` implementing env-var-over-file precedence logic
    - Create `app/src/config/index.ts` exporting `loadConfig()` that reads env vars and optional JSON config file
    - Block initialization and display error message listing missing required keys by name
    - Handle malformed config file with error message and fallback to env-only
    - _Requirements: 21.1, 21.2, 21.3_

  - [ ]* 1.3 Write property tests for Configuration Manager
    - [ ]* 1.3.1 Property 11: Configuration Resolution Precedence
      - **Property 11: Configuration Resolution Precedence**
      - Generate random env vars and file config entries; verify env always wins when both present
      - **Validates: Requirements 21.1**
    - [ ]* 1.3.2 Property 12: Configuration Validation — Missing Required Keys
      - **Property 12: Configuration Validation — Missing Required Keys**
      - Generate random subsets of required keys; verify error lists exactly the missing ones
      - **Validates: Requirements 21.2**

- [ ] 2. Implement Domain Layer — models, validators, and field mapper
  - [ ] 2.1 Define Domain Model interfaces and type enums
    - Create `app/src/domain/models/` with all TypeScript interfaces: `BaseFeature`, `HazardArea`, `EvidencePoint`, `ClearanceTask`, `Route`, `CriticalInfrastructure`, `StatusHistoryEntry`, `ProvenanceRecord`, `Geometry` types
    - Define type unions: `HazardStatus`, `RouteStatus`, `EvidenceType`, `SensitivityLevel`, `ScenarioPhase`, `ClearanceTaskStatus`
    - Ensure zero CesiumJS imports in the entire `domain/` directory
    - Create `DomainFeature` discriminated union type
    - _Requirements: 25.1, 25.2, 9.1_

  - [ ] 2.2 Implement Zod validation schemas for data ingestion
    - Create `app/src/domain/validators/featureSchema.ts` with Zod schemas validating: unique ID presence, valid geometry type, recognized status enum, ISO 8601 date formats
    - Create `app/src/domain/validators/geoJsonSchema.ts` for RFC 7946 GeoJSON FeatureCollection validation
    - Return structured `ValidationResult` with feature index, field, and failure reason
    - _Requirements: 24.1, 24.2, 15.2_

  - [ ] 2.3 Implement Field Mapper with runtime-loadable configuration
    - Create `app/src/domain/mapping/fieldMapper.ts` implementing `mapFields(rawProperties, mapping)` → `{ mapped, unmapped }`
    - Create `app/src/domain/mapping/fieldMappingConfig.ts` for loading/parsing field-mapping JSON at runtime
    - Preserve unmapped properties in a separate record for Feature Inspector display
    - _Requirements: 15.3, 15.4, 17.2_

  - [ ]* 2.4 Write property test for Field Mapping
    - **Property 8: Field Mapping Correctness**
    - Generate random property objects and random mapping configurations; verify partitioning into mapped/unmapped
    - **Validates: Requirements 15.3, 15.4, 17.2**

  - [ ] 2.5 Implement Style Resolver
    - Create `app/src/domain/style/styleConfig.ts` defining `StyleConfig` with unique (fillColor + supplementary differentiator) per status per feature type
    - Create `app/src/domain/style/resolveStyle.ts` returning `FeatureStyle` given feature type + status, with defaults for unknown statuses
    - Ensure color + pattern/icon/label combination is unique per status within each feature type
    - _Requirements: 4.1, 5.1, 5.2, 7.1, 29.1_

  - [ ]* 2.6 Write property test for Style Uniqueness
    - **Property 2: Style Uniqueness per Status**
    - Enumerate all status pairs per feature type; verify style objects differ in at least two visual dimensions
    - **Validates: Requirements 4.1**

  - [ ] 2.7 Implement Status-at-Time Resolution
    - Create `app/src/domain/models/getStatusAtTime.ts` implementing the algorithm: find last status history entry with effectiveTime <= currentTime
    - Return default status when no entry exists for the given time
    - _Requirements: 4.2, 7.2, 13.2, 13.3, 13.4_

  - [ ]* 2.8 Write property test for Status-at-Time Resolution
    - **Property 1: Status-at-Time Resolution**
    - Generate random sorted StatusHistoryEntry arrays and random Date values; verify correct resolution
    - **Validates: Requirements 4.2, 7.2, 13.2, 13.3, 13.4**

  - [ ] 2.9 Implement Provenance Tracker
    - Create `app/src/domain/provenance/provenanceTracker.ts` that records sourceId, ingestionTimestamp, transformation steps, and sensitivityLevel for each feature
    - Classify each source as Category A (synthetic), Category A (public), or Category B (restricted)
    - Return "Provenance unavailable" indicator when metadata is missing
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

  - [ ]* 2.10 Write property test for Provenance Recording
    - **Property 10: Provenance Recording Completeness**
    - Generate random features and source metadata; verify provenance record contains correct sourceId, valid ingestionTimestamp, and non-empty transformation steps
    - **Validates: Requirements 18.1**

- [ ] 3. Checkpoint — Domain Layer
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement Adapter Layer — Data Loaders, ArcGIS Adapter, Cesium Adapter
  - [ ] 4.1 Implement GeoJSON Data Loader
    - Create `app/src/adapters/loaders/geoJsonLoader.ts` parsing RFC 7946 GeoJSON, supporting Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon
    - Integrate Zod validation per feature; skip invalid features with warning log
    - Pipe valid features through Field Mapper, then Deduplicator, then Provenance Tracker
    - Handle unmapped properties preservation
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ]* 4.2 Write property test for GeoJSON Parse Validity
    - **Property 7: GeoJSON Parse Validity — Valid Features Preserved, Invalid Features Skipped**
    - Generate random FeatureCollections with N valid and M invalid features; verify exactly N domain objects produced and M warnings logged
    - **Validates: Requirements 15.1, 15.2, 24.1, 24.2**

  - [ ] 4.3 Implement Duplicate Resolution and Source Health Check
    - Create `app/src/adapters/loaders/deduplicateFeatures.ts` retaining features with most recent `lastUpdated` per duplicate ID
    - Create `app/src/adapters/loaders/checkSourceHealth.ts` emitting source-level warning when >50% features fail validation
    - Log duplicate occurrences with both timestamps
    - _Requirements: 24.3, 24.4_

  - [ ]* 4.4 Write property tests for Duplicate Resolution and Validation Threshold
    - [ ]* 4.4.1 Property 13: Duplicate Resolution by Timestamp
      - **Property 13: Duplicate Resolution by Timestamp**
      - Generate features with duplicate IDs and distinct timestamps; verify only most recent retained
      - **Validates: Requirements 24.3**
    - [ ]* 4.4.2 Property 14: Source-Level Validation Warning Threshold
      - **Property 14: Source-Level Validation Warning Threshold**
      - Generate random N total and M invalid where M/N ratio varies; verify warning emitted only when M > N/2
      - **Validates: Requirements 24.4**

  - [ ] 4.5 Implement CZML Data Loader
    - Create `app/src/adapters/loaders/czmlLoader.ts` parsing CZML files, skipping invalid packets with warning log
    - Integrate with CesiumJS `CzmlDataSource` for native time-interval handling
    - Handle features hidden when timeline outside availability interval
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [ ] 4.6 Implement ArcGIS Adapter
    - Create `app/src/adapters/arcgis/arcgisAdapter.ts` querying feature service with `f=geojson`, paginating via `resultOffset`
    - Implement field mapping from ArcGIS fields to Domain Model using documented mapping config
    - Preserve original ObjectID/GlobalID in `sourceIdentifier`
    - Implement 10-second timeout handling with fallback to cached data
    - Handle authentication/authorization errors with non-blocking notification
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [ ]* 4.7 Write property test for Source Identifier Preservation
    - **Property 9: Source Identifier Preservation**
    - Generate random ArcGIS responses with ObjectID/GlobalID; verify sourceIdentifier matches original value unchanged
    - **Validates: Requirements 17.3**

  - [ ] 4.8 Implement Cesium Adapter
    - Create `app/src/adapters/cesium/cesiumAdapter.ts` transforming Domain features to Cesium entities using Style Resolver output
    - Handle time-dependent styling updates via `onTimeChanged`
    - Support visual highlight (outline/glow) for selected features
    - Handle Category B badge icon on rendered entities
    - Support entity show/hide based on layer visibility and timeline position
    - _Requirements: 4.1, 4.2, 5.1, 7.1, 7.2, 8.1, 19.2_

- [ ] 5. Checkpoint — Adapter Layer
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement State Layer — Zustand Store
  - [ ] 6.1 Create Zustand store with all slices
    - Create `app/src/state/store.ts` with `AppState` interface implementing: config, features, featuresByLayer, layerVisibility, timeline (currentTime, isPlaying, scenarioEvents, currentPhase), selection, comparisonActive, layerErrors, resetToDefaults
    - Implement `toggleLayer`, `stepForward`, `stepBackward`, `play`, `pause`, `seekTo`, `selectFeature`, `toggleComparison`, `dismissError`, `retryLayer`
    - Persist layer visibility in sessionStorage for single-session persistence
    - Default all layers to visible on first load
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 12.1, 23.1_

  - [ ] 6.2 Implement Event Boundary Navigation logic
    - Create `app/src/state/timeline/eventBoundary.ts` with `getNextEventBoundary` and `getPreviousEventBoundary` functions
    - Create `app/src/state/timeline/phaseResolver.ts` mapping time to exactly one ScenarioPhase
    - Implement auto-pause when timeline reaches final event
    - _Requirements: 12.2, 12.3, 12.4, 12.5_

  - [ ]* 6.3 Write property tests for Timeline Navigation
    - [ ]* 6.3.1 Property 5: Event Boundary Navigation
      - **Property 5: Event Boundary Navigation**
      - Generate sorted event lists and random times; verify next/previous boundary correctness
      - **Validates: Requirements 12.2, 12.3**
    - [ ]* 6.3.2 Property 6: Time-to-Phase Mapping
      - **Property 6: Time-to-Phase Mapping**
      - Generate random times within scenario bounds; verify exactly one phase returned with no overlaps or gaps
      - **Validates: Requirements 12.4**

- [ ] 7. Checkpoint — State Layer
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement UI Layer — React Components
  - [ ] 8.1 Implement AppShell with Error Boundary and Disclaimer Banner
    - Create `app/src/components/common/DisclaimerBanner.tsx` — persistent, non-dismissible, highest z-order, ARIA landmark role, 4.5:1 contrast
    - Create `app/src/components/AppShell.tsx` wrapping layout with error boundaries around Viewer, FeatureInspector, and DataLoader
    - Display WebGL-not-supported error message when applicable
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 1.4_

  - [ ] 8.2 Implement ViewerContainer with terrain, navigation, and camera presets
    - Create `app/src/components/viewer/ViewerContainer.tsx` using Resium `<Viewer>` with configured Urban_Context provider
    - Support Cesium World Terrain + OSM Buildings and Google Photorealistic 3D Tiles
    - Implement home control animating camera to default position within 2 seconds
    - Add 3 predefined viewpoint controls (hazard area, clearance task, infrastructure)
    - Handle Urban_Context provider failure gracefully (flat ellipsoid fallback + notification)
    - Support keyboard navigation (pan, rotate, zoom, tilt)
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [ ] 8.3 Implement LayerManager component
    - Create `app/src/components/controls/LayerManager.tsx` with toggle controls for: Urban Context, Hazards, Survey, Evidence, Clearance, Routes, Infrastructure, Boundaries
    - Each toggle visually indicates on/off state
    - Show/hide features within 500ms of toggle
    - Keyboard accessible (Tab + Enter/Space)
    - _Requirements: 10.1, 10.2, 10.3, 29.2_

  - [ ] 8.4 Implement FeatureInspector panel
    - Create `app/src/components/panels/FeatureInspector.tsx` displaying: feature ID, type, name, status, validFrom/validTo (YYYY-MM-DD), organization, confidence (0.0-1.0), sensitivityLevel
    - Display StatusHistory as chronologically ordered list (oldest first)
    - Display provenance section (sourceId, ingestionTimestamp, transformation steps, sensitivity)
    - Display "Provenance unavailable" when metadata missing
    - Display "Unclassified" when sensitivity not assigned
    - Omit absent fields; omit StatusHistory section if empty
    - Open within 500ms on feature click; close on empty-area click
    - Highlight selected feature with outline/glow; remove on deselect
    - Support keyboard Tab cycling through features and Enter to select
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 18.2, 18.4, 19.1, 19.4_

  - [ ]* 8.5 Write property tests for Feature Inspector formatting
    - [ ]* 8.5.1 Property 3: Metadata Formatting Completeness
      - **Property 3: Metadata Formatting Completeness**
      - Generate random BaseFeature with arbitrary optional fields; verify only present fields appear in output
      - **Validates: Requirements 9.1, 9.3**
    - [ ]* 8.5.2 Property 4: Status History Chronological Ordering
      - **Property 4: Status History Chronological Ordering**
      - Generate random unsorted StatusHistoryEntry arrays; verify formatted output is ascending by effectiveTime
      - **Validates: Requirements 9.2**

  - [ ] 8.6 Implement TimeController component
    - Create `app/src/components/controls/TimeController.tsx` with play, pause, step-forward, step-backward, draggable scrubber
    - Display current scenario date and phase label (Initial State, Survey, Clearance, Post-Clearance)
    - Auto-pause at final event
    - Keyboard accessible controls
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 29.2_

  - [ ] 8.7 Implement LegendPanel component
    - Create `app/src/components/panels/LegendPanel.tsx` showing symbology entries for each visible layer group
    - Display shape, color, fill pattern, and status meaning per status value
    - Hide entries when layer toggled off; show "no layers visible" when all off
    - Collapsible/expandable via toggle, visible by default
    - Use text labels + patterns (not color alone)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 29.1_

  - [ ] 8.8 Implement ErrorNotification component with retry
    - Create `app/src/components/common/ErrorNotification.tsx` as dismissible, non-modal toast notifications
    - Show failed layer name, visible for at least 10 seconds or until dismissed
    - Provide retry control per failed layer; show updated notification on repeated failure
    - _Requirements: 22.1, 22.2, 22.3, 22.4_

  - [ ] 8.9 Implement ComparisonMode component
    - Create `app/src/components/viewer/ComparisonMode.tsx` toggling between pre-clearance (Initial State) and post-clearance states
    - Accessible from TimeController or dedicated labeled control
    - Return to current timeline position on deactivation
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [ ] 8.10 Implement Demonstration Reset control
    - Create reset control in main UI toolbar (always accessible)
    - Within 2 seconds: reset camera, reset timeline to initial, pause playback, restore default layer visibility, close Feature Inspector
    - Operable via mouse click and keyboard activation
    - _Requirements: 23.1, 23.2, 23.3_

- [ ] 9. Checkpoint — UI Layer
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement Synthetic Data and Data Integration
  - [ ] 10.1 Create synthetic demonstration scenario data
    - Create `app/public/data/` with GeoJSON files for: Hazard Areas (≥5), Evidence Points (≥5), Clearance Tasks, Routes (≥3 road segments), Critical Infrastructure (school, medical facility, utility corridor, damaged structure, ≥5 buildings)
    - Create CZML file(s) with time-dynamic status transitions across 4 phases (Initial State → Survey → Clearance → Post-Clearance)
    - Include features from at least 2 organizations (≥2 features each)
    - Mark all features with `isSynthetic: true` property
    - Include status transitions for ≥3 feature types (Hazard_Area, Route, Clearance_Task)
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 13.1_

  - [ ] 10.2 Create field-mapping configuration files
    - Create `app/public/data/fieldMapping.json` for GeoJSON → Domain mapping
    - Create `app/public/data/arcgisFieldMapping.json` for ArcGIS → Domain mapping
    - Document mapping in repository README
    - _Requirements: 15.3, 17.2_

  - [ ] 10.3 Wire data loading pipeline into application startup
    - In demo mode: load bundled synthetic data, no external network requests
    - In normal mode: load from configured data-service endpoints and optionally ArcGIS
    - Integrate full pipeline: load → validate → map → deduplicate → provenance → store → render
    - Handle Category C data source rejection with security warning
    - _Requirements: 21.4, 28.4, 28.5_

- [ ] 11. Implement Infrastructure — AWS CDK Stack
  - [ ] 11.1 Create CDK stack with S3, CloudFront, and OAC
    - Create `infra/cdk/` project with CDK v2 TypeScript
    - Define S3 bucket: private, no public access, block all public access settings enabled
    - Define CloudFront distribution: HTTPS redirect, OAC to S3, default root object `index.html`, custom error responses (403 → index.html/200, 404 → index.html/200)
    - Output CloudFront URL and S3 bucket name
    - Ensure no secrets in synthesized template
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 28.1, 28.2_

  - [ ]* 11.2 Write CDK assertion tests
    - Verify S3 bucket is private
    - Verify CloudFront has HTTPS redirect
    - Verify OAC configured
    - Verify custom error responses for SPA routing
    - Verify no secrets in template
    - _Requirements: 27.1, 27.2, 28.1, 28.2, 27.4_

- [ ] 12. Final integration and accessibility pass
  - [ ] 12.1 Wire all components together in AppShell
    - Connect ViewerContainer, LayerManager, FeatureInspector, TimeController, LegendPanel, DisclaimerBanner, ErrorNotification, ComparisonMode, Reset control
    - Ensure correct z-order (DisclaimerBanner always on top)
    - Verify all state subscriptions are correctly wired
    - Implement logical Tab order through all interactive controls
    - Add visible focus indicators (3:1 contrast) for all interactive elements
    - Add accessible names (aria-label) for all iconographic controls
    - _Requirements: 1.1, 29.2, 29.3, 29.4, 29.5_

  - [ ] 12.2 Create documentation
    - Create `docs/architecture/` with component responsibilities and interactions
    - Create `docs/data-model/` describing Domain Model entities and relationships
    - Create `docs/deployment/` with prerequisites, step-by-step commands, verification
    - Create `docs/adr/001-cesium-visualization.md` with context, decision, rationale, alternatives
    - _Requirements: 30.1, 30.2, 30.3, 30.4_

- [ ] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each architectural layer
- Property tests validate the 14 universal correctness properties defined in the design
- Unit tests validate specific examples and edge cases
- The Domain Layer has zero CesiumJS dependencies — it can be tested in isolation
- Demo mode suppresses all external network requests for offline demonstration
- All synthetic data features must carry `isSynthetic: true` for machine-readable identification

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3.1", "1.3.2", "2.2", "2.3", "2.5", "2.7", "2.9"] },
    { "id": 3, "tasks": ["2.4", "2.6", "2.8", "2.10", "4.1", "4.3", "4.5", "4.6", "6.1"] },
    { "id": 4, "tasks": ["4.2", "4.4.1", "4.4.2", "4.7", "4.8", "6.2"] },
    { "id": 5, "tasks": ["6.3.1", "6.3.2", "8.1", "10.1", "10.2"] },
    { "id": 6, "tasks": ["8.2", "8.3", "8.4", "8.6", "8.7", "8.8", "8.9", "8.10", "11.1"] },
    { "id": 7, "tasks": ["8.5.1", "8.5.2", "10.3", "11.2"] },
    { "id": 8, "tasks": ["12.1", "12.2"] }
  ]
}
```

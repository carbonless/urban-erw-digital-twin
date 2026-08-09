import {
  Entity,
  Color,
  Cartesian3,
  PolygonHierarchy,
  ConstantProperty,
  ColorMaterialProperty,
  PolylineOutlineMaterialProperty,
  HeightReference,
  ClassificationType,
  type Viewer,
} from 'cesium';
import type { DomainFeature, GeoPoint, GeoLineString, GeoPolygon, GeoPosition } from '../../domain/models';
import { getStatusAtTime } from '../../domain/models';
import { resolveStyle, type FeatureStyle } from '../../domain/style';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CesiumAdapterOptions {
  viewer: Viewer;
  onFeatureSelect?: (feature: DomainFeature | null) => void;
  showCategoryBBadge?: boolean;
}

export interface RenderedEntity {
  entity: Entity;
  feature: DomainFeature;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function positionToCartesian3(pos: GeoPosition): Cartesian3 {
  return Cartesian3.fromDegrees(
    pos.longitude,
    pos.latitude,
    pos.altitude ?? 0,
  );
}

function cssColorToCesiumColor(cssColor: string, opacity: number = 1.0): Color {
  const color = Color.fromCssColorString(cssColor);
  return color.withAlpha(opacity);
}

// ─── Entity Creation ───────────────────────────────────────────────────────

function createPointEntity(
  feature: DomainFeature & { geometry: GeoPoint },
  style: FeatureStyle,
): Entity {
  const position = positionToCartesian3(feature.geometry.coordinates);

  return new Entity({
    id: feature.id,
    name: feature.name ?? feature.id,
    position,
    point: {
      pixelSize: new ConstantProperty(10),
      color: new ConstantProperty(cssColorToCesiumColor(style.fillColor, style.opacity)),
      outlineColor: new ConstantProperty(cssColorToCesiumColor(style.strokeColor)),
      outlineWidth: new ConstantProperty(style.strokeWidth),
      // Drape onto terrain and 3D Tiles buildings — otherwise points render at
      // the raw geometry altitude and can appear to float above dense urban terrain.
      heightReference: new ConstantProperty(HeightReference.CLAMP_TO_GROUND),
    },
    description: new ConstantProperty(buildDescription(feature)),
  });
}

function createLineEntity(
  feature: DomainFeature & { geometry: GeoLineString },
  style: FeatureStyle,
): Entity {
  const positions = feature.geometry.coordinates.map(positionToCartesian3);

  return new Entity({
    id: feature.id,
    name: feature.name ?? feature.id,
    polyline: {
      positions: new ConstantProperty(positions),
      width: new ConstantProperty(style.strokeWidth),
      material: new PolylineOutlineMaterialProperty({
        color: new ConstantProperty(cssColorToCesiumColor(style.fillColor, style.opacity)),
        outlineColor: new ConstantProperty(cssColorToCesiumColor(style.strokeColor)),
        outlineWidth: new ConstantProperty(1),
      }),
      // Drape the route onto terrain and buildings rather than the raw line altitude.
      clampToGround: new ConstantProperty(true),
      classificationType: new ConstantProperty(ClassificationType.BOTH),
    },
    description: new ConstantProperty(buildDescription(feature)),
  });
}

function createPolygonEntity(
  feature: DomainFeature & { geometry: GeoPolygon },
  style: FeatureStyle,
): Entity {
  const outerRing = feature.geometry.coordinates[0];
  const hierarchy = new PolygonHierarchy(
    outerRing.map(positionToCartesian3),
    feature.geometry.coordinates.slice(1).map(
      (hole) => new PolygonHierarchy(hole.map(positionToCartesian3)),
    ),
  );

  return new Entity({
    id: feature.id,
    name: feature.name ?? feature.id,
    polygon: {
      hierarchy: new ConstantProperty(hierarchy),
      material: new ColorMaterialProperty(
        new ConstantProperty(cssColorToCesiumColor(style.fillColor, style.opacity)),
      ),
      outline: new ConstantProperty(true),
      outlineColor: new ConstantProperty(cssColorToCesiumColor(style.strokeColor)),
      outlineWidth: new ConstantProperty(style.strokeWidth),
      // No height/extrudedHeight set, so this renders as a GroundPrimitive —
      // classificationType controls whether it drapes onto terrain only or
      // also onto 3D Tiles buildings, which matters in dense urban blocks.
      classificationType: new ConstantProperty(ClassificationType.BOTH),
    },
    description: new ConstantProperty(buildDescription(feature)),
  });
}

function buildDescription(feature: DomainFeature): string {
  const lines = [
    `<strong>Type:</strong> ${feature.featureType}`,
    `<strong>Status:</strong> ${feature.status}`,
  ];
  if (feature.name) lines.push(`<strong>Name:</strong> ${feature.name}`);
  if (feature.responsibleOrganization) {
    lines.push(`<strong>Organization:</strong> ${feature.responsibleOrganization}`);
  }
  if (feature.isSynthetic) lines.push('<em>(Synthetic data)</em>');
  return lines.join('<br/>');
}

// ─── Main Adapter ──────────────────────────────────────────────────────────

/**
 * Converts domain features to Cesium entities and adds them to the viewer.
 *
 * Responsibilities:
 * - Transforms domain geometry to Cesium entities with style from Style Resolver
 * - Supports time-dependent styling via onTimeChanged
 * - Handles visual highlight (outline/glow) for selected features
 * - Shows Category B badge icon on restricted entities
 * - Supports entity show/hide based on layer visibility and timeline position
 *
 * @param features Domain features to render
 * @param options Adapter configuration including viewer reference
 * @returns Array of RenderedEntity (entity + source feature pairs)
 */
export function addFeaturesToViewer(
  features: DomainFeature[],
  options: CesiumAdapterOptions,
): RenderedEntity[] {
  const { viewer } = options;
  const rendered: RenderedEntity[] = [];

  for (const feature of features) {
    const style = resolveStyle(feature.featureType, feature.status);
    let entity: Entity | null = null;

    switch (feature.geometry.type) {
      case 'Point':
        entity = createPointEntity(
          feature as DomainFeature & { geometry: GeoPoint },
          style,
        );
        break;
      case 'LineString':
        entity = createLineEntity(
          feature as DomainFeature & { geometry: GeoLineString },
          style,
        );
        break;
      case 'Polygon':
        entity = createPolygonEntity(
          feature as DomainFeature & { geometry: GeoPolygon },
          style,
        );
        break;
    }

    if (entity) {
      viewer.entities.add(entity);
      rendered.push({ entity, feature });
    }
  }

  return rendered;
}

/**
 * Removes all feature entities from the viewer.
 */
export function clearFeatures(viewer: Viewer): void {
  viewer.entities.removeAll();
}

/**
 * Updates entity visibility based on layer visibility map.
 */
export function updateLayerVisibility(
  rendered: RenderedEntity[],
  layerVisibility: Record<string, boolean>,
): void {
  for (const { entity, feature } of rendered) {
    const layerKey = feature.featureType;
    const isVisible = layerVisibility[layerKey] ?? true;
    entity.show = isVisible;
  }
}

/**
 * Updates entity styling based on the current timeline position.
 * Re-resolves status from status history and applies new style.
 */
export function updateEntitiesForTime(
  rendered: RenderedEntity[],
  currentTime: Date,
): void {
  for (const { entity, feature } of rendered) {
    if (feature.statusHistory.length === 0) continue;

    const resolvedStatus = getStatusAtTime(
      feature.statusHistory,
      currentTime,
      feature.status,
    );

    // Only update if status changed
    if (resolvedStatus === feature.status) continue;

    const style = resolveStyle(feature.featureType, resolvedStatus);

    // Update entity styling based on geometry type
    if (entity.point) {
      entity.point.color = new ConstantProperty(
        cssColorToCesiumColor(style.fillColor, style.opacity),
      );
      entity.point.outlineColor = new ConstantProperty(
        cssColorToCesiumColor(style.strokeColor),
      );
    }

    if (entity.polygon) {
      entity.polygon.material = new ColorMaterialProperty(
        new ConstantProperty(cssColorToCesiumColor(style.fillColor, style.opacity)),
      );
      entity.polygon.outlineColor = new ConstantProperty(
        cssColorToCesiumColor(style.strokeColor),
      );
    }

    if (entity.polyline) {
      entity.polyline.material = new PolylineOutlineMaterialProperty({
        color: new ConstantProperty(cssColorToCesiumColor(style.fillColor, style.opacity)),
        outlineColor: new ConstantProperty(cssColorToCesiumColor(style.strokeColor)),
        outlineWidth: new ConstantProperty(1),
      });
    }
  }
}

/**
 * Highlights a selected feature with an outline/glow effect.
 * Pass null to clear selection.
 */
export function highlightFeature(
  rendered: RenderedEntity[],
  selectedId: string | null,
): void {
  const highlightColor = Color.YELLOW.withAlpha(0.8);
  const defaultOutlineWidth = 2;
  const highlightOutlineWidth = 5;

  for (const { entity, feature } of rendered) {
    const isSelected = feature.id === selectedId;

    if (entity.point) {
      entity.point.outlineWidth = new ConstantProperty(
        isSelected ? highlightOutlineWidth : defaultOutlineWidth,
      );
      if (isSelected) {
        entity.point.outlineColor = new ConstantProperty(highlightColor);
      } else {
        const style = resolveStyle(feature.featureType, feature.status);
        entity.point.outlineColor = new ConstantProperty(
          cssColorToCesiumColor(style.strokeColor),
        );
      }
    }

    if (entity.polygon) {
      entity.polygon.outlineWidth = new ConstantProperty(
        isSelected ? highlightOutlineWidth : defaultOutlineWidth,
      );
      if (isSelected) {
        entity.polygon.outlineColor = new ConstantProperty(highlightColor);
      } else {
        const style = resolveStyle(feature.featureType, feature.status);
        entity.polygon.outlineColor = new ConstantProperty(
          cssColorToCesiumColor(style.strokeColor),
        );
      }
    }

    if (entity.polyline) {
      entity.polyline.width = new ConstantProperty(
        isSelected ? highlightOutlineWidth * 2 : defaultOutlineWidth * 2,
      );
    }
  }
}

/**
 * Updates entity visibility based on timeline availability.
 * Hides features whose availability window doesn't contain the current time.
 */
export function updateTimelineVisibility(
  rendered: RenderedEntity[],
  currentTime: Date,
  layerVisibility: Record<string, boolean>,
): void {
  const currentMs = currentTime.getTime();

  for (const { entity, feature } of rendered) {
    // Check layer visibility first
    const layerVisible = layerVisibility[feature.featureType] ?? true;
    if (!layerVisible) {
      entity.show = false;
      continue;
    }

    // Check time availability
    const fromMs = feature.validFrom?.getTime();
    const toMs = feature.validTo?.getTime();

    let timeVisible = true;
    if (fromMs !== undefined && currentMs < fromMs) {
      timeVisible = false;
    }
    if (toMs !== undefined && currentMs > toMs) {
      timeVisible = false;
    }

    entity.show = timeVisible;
  }
}

# Urban ERW Digital Twin

Open 3D geospatial demonstrator for humanitarian mine action, conflict debris management, damage assessment, and urban recovery.

## Why this project exists

Mine-action information systems are still largely organized around two-dimensional land-based contamination. Urban operations are different: explosive ordnance can be associated with multi-storey buildings, basements, rubble, damaged infrastructure, and other vertically distributed features.

The purpose of this project is to explore how an open 3D geospatial layer can complement existing authoritative GIS and information-management systems without replacing them.

## GICHD Innovation Session 2026

VEA Systems developed this Cesium-based prototype before and during participation in the **GICHD Innovation Session 2026: Mine Action in Urban Areas**, held in Geneva from 29 September to 1 October 2026.

VEA participated in the thematic working group on **Adapting information management systems for urban areas**. During that workshop, the group used the working title **“HEIGHT MATTERS!”** to focus attention on the operational importance of the vertical dimension in urban mine action.

The working group identified several related needs:

- represent hazards in buildings, floors, basements, rubble, and other 3D urban contexts;
- supplement traditional square-metre reporting with metrics that better reflect effort, time, and cost;
- remain compatible with existing mine-action information-management systems;
- improve interoperability with damage assessment, debris management, municipalities, land administration, and reconstruction actors;
- provide a common, system-agnostic baseline rather than require a new proprietary platform.

Screenshots from this prototype were used as supporting visual material in the group's non-public working project brief.

**Important:** “HEIGHT MATTERS!” is the working-group brief title from the GICHD Innovation Session. It is not a VEA product name, and this repository should not be read as a GICHD-endorsed platform or official GICHD project.

## What the prototype demonstrates

This Phase 1 demonstrator uses **CesiumJS** and **Cesium ion / 3D Tiles** to explore how conventional 2D mine-action records can be related to a richer 3D urban context.

Current concepts include:

- 3D building context and terrain;
- explosive-remnants-of-war hazard areas;
- damaged-building overlays;
- pre-conflict versus current-state comparison;
- evidence and operational points;
- the ability to associate hazards with structures rather than only surface polygons;
- a future path toward building/floor/depth/rubble attributes;
- interoperability with existing ArcGIS / IMSMA Core workflows rather than replacement of them.

## Broader applicability

The underlying problem extends beyond humanitarian mine action.

Conflict-damaged cities require mine-action, debris-management, engineering, municipal, land-administration, and reconstruction teams to work from overlapping information about:

- buildings and individual units;
- land parcels and property claims;
- structural damage;
- rubble and debris;
- critical infrastructure;
- explosive hazards;
- clearance and recovery status.

This makes the project relevant to **Conflict Debris Management (CDM)**, post-conflict damage assessment, disaster response, cadastral and property-recovery workflows, and broader urban digital-twin interoperability.

## Project direction

The next step is to turn the exploratory prototype into an open reference implementation built around three deliverables:

1. **Open 3D urban hazard data model**  
   Define relationships between conventional 2D hazard/task records and urban entities such as buildings, floors, elevation/depth, damaged structures, rubble, evidence, and operational status.

2. **Cesium reference demonstrator**  
   Show how those records can be connected to 3D buildings and vertical locations using CesiumJS, Cesium ion, and 3D Tiles.

3. **Open implementation guidance**  
   Publish example mappings, sample data structures, documentation, and a reproducible tutorial so other humanitarian and geospatial organizations can reuse the pattern.

## Open-source intent

The reference data model, example mappings, demonstration code, documentation, and implementation guidance developed for this work are intended to be open and reusable.

Future consulting, integration, deployment, or operational-support services may be provided separately, but they are not required to use the open reference implementation.

## Technology

- CesiumJS
- Cesium ion
- 3D Tiles
- TypeScript / React
- Vite
- ArcGIS / IMSMA Core interoperability as a target workflow

## Status

**Phase 1 — exploratory demonstrator**

The current repository is a prototype and reference environment, not an operational clearance system and not a substitute for approved mine-action standards, national authority procedures, or authoritative information-management systems.

## Repository structure

```
urban-erw-digital-twin/
├── app/
│   ├── src/
│   ├── public/
│   └── data/
├── infra/
│   └── cdk/
├── docs/
│   ├── PRD/
│   ├── architecture/
│   ├── adr/
│   ├── data-model/
│   └── deployment-diary/
└── README.md
```

/* Copyright (C) 2025 flywave.gl contributors */

import {
    type Feature,
    type FeatureCollection,
    type GeoJson,
    type LineString as GeoJsonLineString,
    type Point as GeoJsonPoint,
    type Polygon as GeoJsonPolygon
} from "@flywave/flywave-datasource-protocol";
import { GeoCoordinates } from "@flywave/flywave-geoutils";

/**
 * GeoJSON Point geometry with a strongly-typed coordinate triple.
 */
export interface TypedPointGeometry extends GeoJsonPoint {
    /** `[longitude, latitude, altitude]` */
    coordinates: [number, number, number?];
}

/**
 * GeoJSON LineString geometry with a strongly-typed coordinate array.
 */
export interface TypedLineStringGeometry extends GeoJsonLineString {
    /** Array of `[longitude, latitude, altitude?]` tuples. */
    coordinates: Array<[number, number, number?]>;
}

/**
 * GeoJSON Polygon geometry (outer ring only) with strongly-typed coordinates.
 */
export interface TypedPolygonGeometry extends GeoJsonPolygon {
    /** Outer ring as array of `[longitude, latitude, altitude?]` tuples. */
    coordinates: [Array<[number, number, number?]>];
}

/** Union of the geometry types the draw-controls can create directly. */
export type DrawGeometry = TypedPointGeometry | TypedLineStringGeometry | TypedPolygonGeometry;

/**
 * Discriminated union of GeoJSON geometry objects emitted by draw objects.
 *
 * @remarks
 * The `type` field is used as a discriminant so `switch (geometry.type)` narrows
 * correctly without needing `any` casts.
 */
export type DrawGeoJsonGeometry =
    | { type: "Point"; coordinates: [number, number, number?] }
    | { type: "LineString"; coordinates: Array<[number, number, number?]> }
    | { type: "Polygon"; coordinates: [Array<[number, number, number?]>] };

/**
 * A GeoJSON Feature carrying a draw geometry.
 */
export interface DrawFeature extends Feature {
    geometry: DrawGeoJsonGeometry;
}

/**
 * A GeoJSON FeatureCollection of draw features.
 */
export interface DrawFeatureCollection extends FeatureCollection {
    features: DrawFeature[];
}

/** Union describing every GeoJSON payload produced or consumed by draw controls. */
export type DrawGeoJson = DrawGeoJsonGeometry | DrawFeature | DrawFeatureCollection | GeoJson;

/**
 * Helper type guard: narrows an arbitrary GeoJson geometry to a {@link TypedPointGeometry}.
 */
export function isPointGeometry(geometry: unknown): geometry is TypedPointGeometry {
    return (
        typeof geometry === "object" &&
        geometry !== null &&
        (geometry as { type?: string }).type === "Point" &&
        Array.isArray((geometry as { coordinates?: unknown }).coordinates)
    );
}

/**
 * Helper type guard: narrows an arbitrary GeoJson geometry to a {@link TypedLineStringGeometry}.
 */
export function isLineStringGeometry(geometry: unknown): geometry is TypedLineStringGeometry {
    return (
        typeof geometry === "object" &&
        geometry !== null &&
        (geometry as { type?: string }).type === "LineString" &&
        Array.isArray((geometry as { coordinates?: unknown }).coordinates)
    );
}

/**
 * Helper type guard: narrows an arbitrary GeoJson geometry to a {@link TypedPolygonGeometry}.
 */
export function isPolygonGeometry(geometry: unknown): geometry is TypedPolygonGeometry {
    return (
        typeof geometry === "object" &&
        geometry !== null &&
        (geometry as { type?: string }).type === "Polygon" &&
        Array.isArray((geometry as { coordinates?: unknown }).coordinates)
    );
}

/**
 * Convert a `[longitude, latitude, altitude?]` coordinate tuple to a {@link GeoCoordinates}.
 *
 * @param coord - GeoJSON position tuple.
 * @returns The equivalent geographic coordinate.
 */
export function coordToGeoCoordinates(coord: readonly [number, number, number?]): GeoCoordinates {
    return new GeoCoordinates(coord[1], coord[0], coord[2] ?? 0);
}

/**
 * Convert an array of GeoJSON position tuples to an array of {@link GeoCoordinates}.
 *
 * @param coords - Array of `[longitude, latitude, altitude?]` tuples.
 */
export function coordsToGeoCoordinates(
    coords: ReadonlyArray<readonly [number, number, number?]>
): GeoCoordinates[] {
    return coords.map(coordToGeoCoordinates);
}

/**
 * Convert a {@link GeoCoordinates} back to a GeoJSON position tuple.
 *
 * @param vertex - Geographic coordinate.
 * @returns `[longitude, latitude, altitude]`
 */
export function geoCoordinatesToCoord(vertex: GeoCoordinates): [number, number, number] {
    return [vertex.longitude, vertex.latitude, vertex.altitude ?? 0];
}

/**
 * Convert an array of {@link GeoCoordinates} to an array of GeoJSON position tuples.
 */
export function geoCoordinatesToCoords(vertices: readonly GeoCoordinates[]): Array<[number, number, number]> {
    return vertices.map(geoCoordinatesToCoord);
}

/**
 * Mouse event type used by {@link MapDrawControls} internal event handlers.
 *
 * @remarks
 * The event is provided by `WindowEventHandler` which normalises browser events
 * to an object that at least carries `offsetX`/`offsetY`/`clientX`/`clientY`.
 */
export interface DrawMouseEvent extends MouseEvent {
    readonly offsetX: number;
    readonly offsetY: number;
    readonly clientX: number;
    readonly clientY: number;
    readonly deltaY?: number;
}

/**
 * Wheel event exposed to draw controls.
 */
export interface DrawWheelEvent extends WheelEvent {
    readonly offsetX: number;
    readonly offsetY: number;
    readonly deltaY: number;
}

/**
 * Interface for draw objects that expose an ordered list of vertex control points.
 *
 * @remarks
 * Implemented by {@link DrawLine} and {@link DrawPolygon} so that helpers like
 * the {@link HeightAdjustManager} can attach to a specific vertex without
 * needing to know the concrete object type.
 */
export interface VertexContainer {
    /** Return the vertex control points for interactive editing. */
    getVertexPoints(): PointObjectLike[];
}

/**
 * Structural type for objects that behave like a {@link PointObject}, as used by
 * the {@link HeightAdjustManager}.
 */
export interface PointObjectLike {
    /** Geographic centre of the point. */
    getCenter(): GeoCoordinates;
    /** Current height / altitude. */
    getHeight(): number;
    /** Update the height / altitude. */
    setHeight(height: number): void;
}

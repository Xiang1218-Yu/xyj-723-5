/* Copyright (C) 2025 flywave.gl contributors */

import { GeoCoordinates } from "@flywave/flywave-geoutils";
import { type MapView, MapViewEventNames } from "@flywave/flywave-mapview";
import * as THREE from "three";

import { type DrawGeoJsonGeometry, geoCoordinatesToCoord } from "./DrawTypes";

/**
 * Abstract base class for all drawable map objects (points, lines, polygons).
 *
 * @remarks
 * `DrawableObject` extends {@link THREE.Object3D} so it can be added directly to
 * the scene graph. It centralises:
 * - selection / editing state
 * - vertex management
 * - camera-move listener hookup
 * - GeoJSON serialisation contract
 *
 * Subclasses must implement the abstract methods for geometry updates, visual
 * feedback and resource disposal.
 */
export abstract class DrawableObject extends THREE.Object3D {
    /** Whether the object is currently selected. */
    public isSelected: boolean = false;
    /** Whether the object is currently in editing mode. */
    public isEditing: boolean = false;

    /** Reference to the owning MapView, used for projection and camera access. */
    protected mapView: MapView;

    /** Optional outline / halo object managed by the subclass. */
    protected outlineObject: THREE.Object3D | null = null;

    /** Geographic vertices that define the shape. */
    protected vertices: GeoCoordinates[] = [];

    /**
     * Bound camera-move handler. Kept as a field so it can be removed on dispose.
     */
    private readonly doCameraPositionChanged = (): void => {
        this.onCameraPositionChanged();
    };

    constructor(mapView: MapView, id?: string) {
        super();
        this.mapView = mapView;
        if (id !== undefined) {
            this.userData.id = id;
        }

        mapView.addEventListener(
            MapViewEventNames.CameraPositionChanged,
            this.doCameraPositionChanged
        );
    }

    /**
     * Hook invoked whenever the map camera moves. Subclasses may override to
     * update screen-space sized elements or labels.
     */
    protected onCameraPositionChanged(): void {
        // Default no-op; subclasses override as needed.
    }

    /** Create the outline/halo visual for this object. */
    protected abstract createOutlineObject(): void;
    /** Select or deselect a specific vertex by index. */
    public abstract setVertexSelected(index: number, selected: boolean): void;
    /** Query the selection state of a specific vertex. */
    public abstract getVertexSelected(index: number): boolean;
    /** Rebuild GPU geometry from the current vertex set. */
    public abstract update(): void;
    /** Serialise this object to a GeoJSON geometry descriptor. */
    public abstract toGeoJSON(): DrawGeoJsonGeometry;
    /** Update visual feedback (colors, widths, …) based on selection/editing state. */
    protected abstract updateVisuals(): void;

    /**
     * Update a single vertex position.
     *
     * @param index - Index of the vertex to update.
     * @param newVertex - New geographic coordinate.
     */
    public abstract updateVertex(index: number, newVertex: GeoCoordinates): void;

    /**
     * Translate the entire object so that its centre lands at `newPosition`.
     *
     * @param newPosition - Target centre coordinate.
     */
    public abstract moveTo(newPosition: GeoCoordinates): void;

    /**
     * Compute the geographic centre (average) of the object.
     */
    public abstract getCenter(): GeoCoordinates;

    /**
     * Return the underlying THREE.js object (the object itself, since `DrawableObject`
     * already extends `Object3D`).
     */
    public getObject3D(): THREE.Object3D {
        return this;
    }

    /**
     * Replace all vertices.
     *
     * @param vertices - New vertex array.
     */
    public setVertices(vertices: GeoCoordinates[]): void {
        this.vertices = vertices;
        this.update();
    }

    /** Return a defensive copy of the vertex array. */
    public getVertices(): GeoCoordinates[] {
        return [...this.vertices];
    }

    /**
     * Append a vertex.
     *
     * @param vertex - Coordinate to append.
     */
    public addVertex(vertex: GeoCoordinates): void {
        this.vertices.push(vertex);
        this.update();
    }

    /**
     * Remove a vertex by index.
     *
     * @param index - Position of the vertex to remove.
     */
    public removeVertex(index: number): void {
        if (index >= 0 && index < this.vertices.length) {
            this.vertices.splice(index, 1);
            this.update();
        }
    }

    /**
     * Set the selection flag and refresh visuals on change.
     */
    public setSelected(selected: boolean): void {
        if (this.isSelected !== selected) {
            this.isSelected = selected;
            this.updateVisuals();
        }
    }

    /**
     * Set the editing flag and refresh visuals on change.
     */
    public setEditing(editing: boolean): void {
        if (this.isEditing !== editing) {
            this.isEditing = editing;
            this.updateVisuals();
        }
    }

    /** Current selection state. */
    public getSelected(): boolean {
        return this.isSelected;
    }

    /** Current editing state. */
    public getEditing(): boolean {
        return this.isEditing;
    }

    /**
     * Atomically update both selection and editing state.
     */
    public updateState(isSelected: boolean, isEditing: boolean): void {
        const needsUpdate = this.isSelected !== isSelected || this.isEditing !== isEditing;
        this.isSelected = isSelected;
        this.isEditing = isEditing;
        if (needsUpdate) {
            this.updateVisuals();
        }
    }

    /**
     * Release all GPU and event-listener resources held by this object.
     *
     * @remarks
     * Subclasses should call `super.dispose()` after cleaning up their own
     * geometry and materials so that the camera listener is always removed.
     */
    public dispose(): void {
        this.mapView.removeEventListener(
            MapViewEventNames.CameraPositionChanged,
            this.doCameraPositionChanged
        );

        if (this.outlineObject) {
            this.remove(this.outlineObject);
            disposeObject3DResources(this.outlineObject);
            this.outlineObject = null;
        }

        this.removeFromParent();
    }

    /**
     * Build a GeoJSON position tuple `[longitude, latitude, altitude]` for a vertex.
     *
     * @param vertex - Geographic coordinate to convert.
     */
    protected static toCoord(vertex: GeoCoordinates): [number, number, number] {
        return geoCoordinatesToCoord(vertex);
    }

    /**
     * Create `GeoCoordinates` from a GeoJSON position tuple `[lng, lat, alt?]`.
     */
    protected static fromCoord(coord: readonly [number, number, number?]): GeoCoordinates {
        return new GeoCoordinates(coord[1], coord[0], coord[2] ?? 0);
    }

    /**
     * Convert an array of GeoJSON position tuples to `GeoCoordinates`.
     */
    protected static fromCoords(
        coordinates: ReadonlyArray<readonly [number, number, number?]>
    ): GeoCoordinates[] {
        return coordinates.map(c => DrawableObject.fromCoord(c));
    }
}

/**
 * Type guard that checks whether an `Object3D` looks like a mesh/line that
 * carries a disposable geometry and material.
 *
 * @internal
 */
function hasDisposableResources(obj: THREE.Object3D): obj is THREE.Object3D & {
    geometry?: THREE.BufferGeometry;
    material?: THREE.Material | THREE.Material[];
} {
    return "geometry" in obj || "material" in obj;
}

/**
 * Safely dispose geometry and material resources attached to an `Object3D`
 * without casting through `any`.
 *
 * @internal
 */
function disposeObject3DResources(obj: THREE.Object3D): void {
    if (!hasDisposableResources(obj)) {
        return;
    }

    obj.geometry?.dispose();

    if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose());
    } else if (obj.material) {
        obj.material.dispose();
    }
}

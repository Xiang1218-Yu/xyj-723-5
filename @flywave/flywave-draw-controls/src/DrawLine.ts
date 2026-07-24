/* Copyright (C) 2025 flywave.gl contributors */

import { GeoCoordinates } from "@flywave/flywave-geoutils";
import { type MapView } from "@flywave/flywave-mapview";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";

import { DrawableObject } from "./DrawableObject";
import { drawMaterialFactory, type DrawMaterialFactory } from "./DrawMaterials";
import { PointObject } from "./PointObject";
import { type DrawGeoJsonGeometry } from "./DrawTypes";

export class DrawLine extends DrawableObject {
    protected outlineLine: Line2 | null = null;

    // Change private properties to protected properties so that subclasses can access them
    protected line: Line2;
    protected lineContainer: THREE.Object3D;
    protected baseLineWidth: number = 2;
    protected lineColor: number = 0xffff00;
    protected vertexPoints: PointObject[] = [];

    /**
     * Centralised material factory used to create line/outline materials.
     * Subclasses (e.g. {@link MeasureLine}) may replace this with a custom
     * factory to override material creation without touching the draw logic.
     */
    protected materialFactory: DrawMaterialFactory = drawMaterialFactory;

    /** Strongly-typed reference to the main line geometry (avoids repeated casts). */
    protected lineGeometry!: LineGeometry;
    /** Strongly-typed reference to the main line material (avoids repeated casts). */
    protected lineMaterial!: LineMaterial;
    /** Strongly-typed reference to the outline line material (avoids repeated casts). */
    protected outlineLineMaterial!: LineMaterial;

    constructor(mapView: MapView, vertices: GeoCoordinates[] = [], id?: string) {
        super(mapView, id);
        this.vertices = vertices;

        this.lineGeometry = new LineGeometry();
        this.lineMaterial = this.createLineMaterial(this.lineColor, this.baseLineWidth);

        this.line = new Line2(this.lineGeometry, this.lineMaterial);
        this.line.renderOrder = 1;

        this.lineContainer = new THREE.Object3D();
        this.lineContainer.add(this.line);
        this.add(this.lineContainer);

        this.createVertexPoints();
        this.createOutlineObject();
        this.update();
    }

    /**
     * Create line material
     * @param color - Line color
     * @param linewidth - Line width
     * @returns LineMaterial instance
     */
    protected createLineMaterial(color: number, linewidth: number): LineMaterial {
        return this.materialFactory.createMainLineMaterial(color, linewidth);
    }

    /**
     * Update vertex position
     * @param index - Vertex index
     * @param newVertex - New vertex coordinates
     */
    public updateVertex(index: number, newVertex: GeoCoordinates): void {
        if (index >= 0 && index < this.vertices.length) {
            this.vertices[index] = newVertex;

            // Synchronously update the corresponding vertex visualization point
            if (index < this.vertexPoints.length) {
                this.vertexPoints[index].moveTo(newVertex);
                this.vertexPoints[index].update(); // Ensure immediate update
            }

            this.update(); // Update the line itself
        }
    }

    /**
     * Move the entire line to a new position
     * @param newPosition - New position coordinates
     */
    public moveTo(newPosition: GeoCoordinates): void {
        if (this.vertices.length === 0) return;

        const center = this.getCenter();
        const deltaLat = newPosition.latitude - center.latitude;
        const deltaLon = newPosition.longitude - center.longitude;

        // Move all vertices
        for (let i = 0; i < this.vertices.length; i++) {
            const vertex = this.vertices[i];
            const newVertex = new GeoCoordinates(
                vertex.latitude + deltaLat,
                vertex.longitude + deltaLon,
                vertex.altitude
            );
            this.vertices[i] = newVertex;

            // Synchronously update vertex visualization points
            if (i < this.vertexPoints.length) {
                this.vertexPoints[i].moveTo(newVertex);
            }
        }

        this.update();
    }

    /**
     * Set line vertices
     * @param vertices - Vertex coordinate array
     */
    public setVertices(vertices: GeoCoordinates[]): void {
        if (vertices.length < 2) return;

        this.vertices = vertices;

        // Recreate vertex points
        this.createVertexPoints();
        this.update();
    }

    /**
     * Get the center point coordinates of the line
     * @returns Center point coordinates of the line
     */
    public getCenter(): GeoCoordinates {
        if (!this.vertices || this.vertices.length === 0) {
            return new GeoCoordinates(0, 0);
        }

        let avgLat = 0;
        let avgLon = 0;
        let avgAlt = 0;

        this.vertices.forEach(vertex => {
            avgLat += vertex.latitude;
            avgLon += vertex.longitude;
            avgAlt += vertex.altitude || 0;
        });

        return new GeoCoordinates(
            avgLat / this.vertices.length,
            avgLon / this.vertices.length,
            avgAlt / this.vertices.length
        );
    }

    /**
     * Update line display
     */
    public update(): void {
        if (!this.vertices || this.vertices.length < 2) {
            this.line.visible = false;
            return;
        } else {
            this.line.visible = true;
        }

        // Calculate the center point as the origin of local coordinates
        const center = this.getCenter();
        const centerProjected = this.mapView.projection.projectPoint(center);

        // Set the position of the line container
        this.lineContainer.position.copy(centerProjected);

        // Calculate local coordinates relative to the center point
        const positions = this.vertices.map(vertex => {
            const projected = this.mapView.projection.projectPoint(vertex);
            return new THREE.Vector3(
                projected.x - centerProjected.x,
                projected.y - centerProjected.y,
                projected.z - centerProjected.z
            );
        });

        const vertices = positions.flatMap(pos => [pos.x, pos.y, pos.z]);
        this.lineGeometry.setPositions(vertices);

        // Ensure the number of vertex visualization points matches
        if (this.vertexPoints.length !== this.vertices.length) {
            this.createVertexPoints();
        } else {
            // Synchronize the positions of vertex visualization points
            for (let i = 0; i < this.vertices.length; i++) {
                if (i < this.vertexPoints.length) {
                    this.vertexPoints[i].moveTo(this.vertices[i]);
                    this.vertexPoints[i].update(); // Ensure immediate update
                }
            }
        }

        this.updateVisuals();
    }

    /**
     * Set vertex selection state
     * @param index - Vertex index
     * @param selected - Whether selected
     */
    public setVertexSelected(index: number, selected: boolean): void {
        if (index >= 0 && index < this.vertexPoints.length) {
            this.vertexPoints[index].setSelected(selected);

            // If the vertex is selected, display the height handle
            if (selected) {
                this.vertexPoints[index].setEditing(true);
            } else {
                this.vertexPoints[index].setEditing(false);
            }
        }
    }

    /**
     * Get vertex selection state
     * @param index - Vertex index
     * @returns Whether selected
     */
    public getVertexSelected(index: number): boolean {
        return index >= 0 && index < this.vertexPoints.length
            ? this.vertexPoints[index].isSelected
            : false;
    }

    /**
     * Update line visual effects
     */
    protected updateVisuals(): void {
        if (this.isSelected) {
            this.lineMaterial.color.set(0x00ff00);
            this.lineMaterial.linewidth = this.baseLineWidth * 2;

            // When the object is selected, all vertices are also displayed as selected
            this.vertexPoints.forEach(point => {
                point.setSelected(true);
            });
        } else {
            this.lineMaterial.color.set(this.lineColor);
            this.lineMaterial.linewidth = this.baseLineWidth;

            // When the object is deselected, all vertices are also deselected
            this.vertexPoints.forEach(point => {
                point.setSelected(false);
                point.setEditing(false);
            });
        }
    }

    /**
     * Convert to GeoJSON format
     * @returns GeoJSON object
     */
    public toGeoJSON(): DrawGeoJsonGeometry {
        return {
            type: "LineString",
            coordinates: this.vertices.map(v => [v.longitude, v.latitude, v.altitude ?? 0] as [number, number, number])
        };
    }

    /**
     * Dispose line resources
     */
    public dispose(): void {
        super.dispose();

        // Remove lineContainer from parent object
        if (this.lineContainer.parent) {
            this.lineContainer.parent.remove(this.lineContainer);
        }

        this.lineGeometry.dispose();
        this.lineMaterial.dispose();

        this.vertexPoints.forEach(point => {
            point.dispose();
        });
        this.vertexPoints = [];

        // Clean up outlineLine
        if (this.outlineLine) {
            // The outline shares geometry with the main line, so only the
            // outline's own material needs to be released here.
            this.outlineLineMaterial.dispose();
            this.outlineLine = null;
        }
    }

    /**
     * Get vertex visualization points array
     * @returns PointObject array
     */
    public getVertexPoints(): PointObject[] {
        return this.vertexPoints;
    }

    /**
     * Create outline object
     */
    protected createOutlineObject(): void {
        // Directly use the main line's geometry to avoid repeated creation and calculation
        this.outlineLineMaterial = this.createOutlineMaterial();

        this.outlineLine = new Line2(this.lineGeometry, this.outlineLineMaterial); // Share the same geometry
        this.outlineLine.renderOrder = -10;
        this.outlineLine.raycast = () => {};

        this.lineContainer.add(this.outlineLine);
    }

    /**
     * Create outline material
     * @returns LineMaterial instance
     */
    protected createOutlineMaterial(): LineMaterial {
        return this.materialFactory.createOutlineLineMaterial();
    }

    /**
     * Create vertex visualization points
     */
    protected createVertexPoints(): void {
        // Clean up existing points
        this.vertexPoints.forEach(point => {
            this.remove(point.getObject3D());
            point.dispose();
        });
        this.vertexPoints = [];

        // Create new vertex points
        for (let i = 0; i < this.vertices.length; i++) {
            // Use factory method to create vertex points, allowing subclass override
            const vertexPoint = this.createVertexPoint(this.vertices[i], true);

            // Add index identifier to the vertex
            vertexPoint.getObject3D().userData.vertexIndex = i;
            vertexPoint.getObject3D().userData.parentObject = this;

            this.vertexPoints.push(vertexPoint);
            this.add(vertexPoint.getObject3D());
        }
    }

    /**
     * Create vertex visualization point object
     * @param position - Vertex position
     * @param isVertex - Whether it is a vertex
     * @returns PointObject instance
     */
    protected createVertexPoint(position: GeoCoordinates, isVertex: boolean): PointObject {
        return new PointObject(this.mapView, position, isVertex);
    }
}

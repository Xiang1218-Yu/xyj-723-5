/* Copyright (C) 2025 flywave.gl contributors */

import {
    type Feature,
    type FeatureCollection,
    type FeatureGeometry,
    type GeoJson,
    type GeometryCollection,
    type LineString as GeoJsonLineString,
    type Point as GeoJsonPoint,
    type Polygon as GeoJsonPolygon
} from "@flywave/flywave-datasource-protocol";
import { GeoCoordinates } from "@flywave/flywave-geoutils";
import { type MapControls } from "@flywave/flywave-map-controls";
import { type MapView } from "@flywave/flywave-mapview";

import { DrawableObject } from "./DrawableObject";
import { DrawLine } from "./DrawLine";
import { DrawPolygon } from "./DrawPolygon";
import {
    isLineStringGeometry,
    isPointGeometry,
    isPolygonGeometry,
    type CoordinateArray,
    type CoordinateTuple,
    type DrawLineStringGeometry,
    type DrawPointGeometry,
    type DrawPolygonGeometry
} from "./DrawTypes";
import { MapDrawControls } from "./MapDrawControls";
import { PointObject } from "./PointObject";

/**
 * 类型守卫：检查是否为 GeometryCollection
 * @param geometry - 几何体
 * @returns 是否为 GeometryCollection
 */
function isGeometryCollection(geometry: FeatureGeometry | GeometryCollection): geometry is GeometryCollection {
    return geometry.type === "GeometryCollection";
}

/**
 * GeoJSON 绘制控件类
 *
 * 职责：
 * - 从 GeoJSON 数据创建绘制对象
 * - 支持 Feature、FeatureCollection 和纯几何体
 * - 基于几何体类型的对象创建工厂方法
 * - 使用精确类型，杜绝 any 类型
 * - 支持对象更新和属性同步
 */
export class GeoJSONDrawControls extends MapDrawControls {
    /**
     * 构造函数
     *
     * @param mapView - 地图视图实例
     * @param mapControls - 地图控件实例
     */
    constructor(mapView: MapView, mapControls: MapControls) {
        super(mapView, mapControls);
    }

    /**
     * 从 GeoJSON 数据创建绘制对象数组
     *
     * @param geoJson - GeoJSON 数据
     * @returns 创建的绘制对象数组
     */
    public createObjectsFromGeoJSON(geoJson: GeoJson): DrawableObject[] {
        const objects: DrawableObject[] = [];

        if (!geoJson) {
            console.error("Invalid GeoJSON format");
            return objects;
        }

        if (this.isFeatureCollection(geoJson)) {
            geoJson.features.forEach((feature: Feature) => {
                const object = this.createObjectFromFeature(feature);
                if (object) {
                    objects.push(object);
                }
            });
        } else if (this.isFeature(geoJson)) {
            const object = this.createObjectFromFeature(geoJson);
            if (object) {
                objects.push(object);
            }
        } else {
            const object = this.createObjectFromGeometry(geoJson as FeatureGeometry);
            if (object) {
                objects.push(object);
            }
        }

        return objects;
    }

    /**
     * 类型守卫：检查是否为 FeatureCollection
     *
     * @param geoJson - GeoJSON 对象
     * @returns 是否为 FeatureCollection
     */
    private isFeatureCollection(geoJson: GeoJson): geoJson is FeatureCollection {
        return (geoJson as FeatureCollection).type === "FeatureCollection";
    }

    /**
     * 类型守卫：检查是否为 Feature
     *
     * @param geoJson - GeoJSON 对象
     * @returns 是否为 Feature
     */
    private isFeature(geoJson: GeoJson): geoJson is Feature {
        return (geoJson as Feature).type === "Feature";
    }

    /**
     * 从 Feature 创建绘制对象
     *
     * @param feature - Feature 对象
     * @returns DrawableObject 实例或 null
     */
    private createObjectFromFeature(feature: Feature): DrawableObject | null {
        try {
            let object: DrawableObject | null = null;

            if (!isGeometryCollection(feature.geometry)) {
                object = this.createObjectFromGeometry(feature.geometry);
            }

            if (object) {
                if (feature.id !== undefined) {
                    object.userData.featureId = feature.id;
                }

                if (feature.properties) {
                    object.userData.properties = feature.properties;
                }
            }

            return object;
        } catch (error) {
            console.error("Error creating object from Feature:", error);
            return null;
        }
    }

    /**
     * 从几何体创建绘制对象（工厂方法）
     *
     * @param geometry - GeoJSON 几何体
     * @returns DrawableObject 实例或 null
     *
     * 说明：使用类型守卫替代 any 类型检查
     */
    private createObjectFromGeometry(geometry: FeatureGeometry): DrawableObject | null {
        try {
            if (isPointGeometry(geometry)) {
                return this.createPointFromGeometry(geometry);
            } else if (isLineStringGeometry(geometry)) {
                return this.createLineFromGeometry(geometry);
            } else if (isPolygonGeometry(geometry)) {
                return this.createPolygonFromGeometry(geometry);
            }

            console.warn(`Unsupported geometry type: ${geometry.type}`);
            return null;
        } catch (error) {
            console.error("Error creating object from geometry:", error);
            return null;
        }
    }

    /**
     * 从 Point 几何体创建点对象
     *
     * @param geometry - Point 几何体
     * @returns PointObject 实例或 null
     */
    private createPointFromGeometry(geometry: DrawPointGeometry): PointObject | null {
        if (!geometry || geometry.type !== "Point" || !geometry.coordinates) {
            return null;
        }

        try {
            const coordinates = geometry.coordinates as CoordinateTuple;
            const position = new GeoCoordinates(
                coordinates[1],
                coordinates[0],
                coordinates[2] || 0
            );

            return new PointObject(this.mapView, position);
        } catch (error) {
            console.error("Error creating PointObject from geometry:", error);
            return null;
        }
    }

    /**
     * 从 LineString 几何体创建线对象
     *
     * @param geometry - LineString 几何体
     * @returns DrawLine 实例或 null
     */
    private createLineFromGeometry(geometry: DrawLineStringGeometry): DrawLine | null {
        if (!geometry || geometry.type !== "LineString" || !geometry.coordinates) {
            return null;
        }

        try {
            const coordinates = geometry.coordinates as CoordinateArray;
            const vertices = DrawableObject.createVerticesFromCoordinates(coordinates);
            return new DrawLine(this.mapView, vertices);
        } catch (error) {
            console.error("Error creating DrawLine from geometry:", error);
            return null;
        }
    }

    /**
     * 从 Polygon 几何体创建多边形对象
     *
     * @param geometry - Polygon 几何体
     * @returns DrawPolygon 实例或 null
     */
    private createPolygonFromGeometry(geometry: DrawPolygonGeometry): DrawPolygon | null {
        if (!geometry || geometry.type !== "Polygon" || !geometry.coordinates) {
            return null;
        }

        try {
            if (geometry.coordinates.length === 0) {
                return null;
            }
            const coordinates = geometry.coordinates[0] as CoordinateArray;
            const vertices = DrawableObject.createVerticesFromCoordinates(coordinates);
            return new DrawPolygon(this.mapView, vertices);
        } catch (error) {
            console.error("Error creating DrawPolygon from geometry:", error);
            return null;
        }
    }

    /**
     * 添加 GeoJSON 数据到绘制控件
     *
     * @param geoJson - GeoJSON 数据
     * @returns 成功添加的对象数量
     */
    public addGeoJSON(geoJson: GeoJson): number {
        const objects = this.createObjectsFromGeoJSON(geoJson);
        this.addObjects(objects);
        return objects.length;
    }

    /**
     * 使用 GeoJSON 数据更新现有对象
     *
     * @param geoJson - GeoJSON 数据
     * @returns 成功更新的对象数量
     */
    public updateGeoJSON(geoJson: GeoJson): number {
        let updateCount = 0;

        if (!geoJson) {
            return updateCount;
        }

        const features: Feature[] = [];
        if (this.isFeatureCollection(geoJson)) {
            features.push(...geoJson.features);
        } else if (this.isFeature(geoJson)) {
            features.push(geoJson);
        }

        features.forEach((feature: Feature) => {
            try {
                if (feature.id !== undefined) {
                    const existingObject = this.getObjects().find(
                        obj => obj.userData.featureId === feature.id
                    );

                    if (existingObject && !isGeometryCollection(feature.geometry)) {
                        this.updateObjectFromGeometry(existingObject, feature.geometry);
                        updateCount++;
                    }
                }
            } catch (error) {
                console.error("Error updating object from Feature:", error);
            }
        });

        return updateCount;
    }

    /**
     * 根据几何体数据更新现有对象
     *
     * @param object - 现有对象
     * @param geometry - 几何体数据
     */
    private updateObjectFromGeometry(object: DrawableObject, geometry: FeatureGeometry): void {
        try {
            if (isPointGeometry(geometry) && object instanceof PointObject) {
                const coordinates = geometry.coordinates as CoordinateTuple;
                const newPosition = new GeoCoordinates(
                    coordinates[1],
                    coordinates[0],
                    coordinates[2] || 0
                );
                object.moveTo(newPosition);
            } else if (isLineStringGeometry(geometry) && object instanceof DrawLine) {
                const coordinates = geometry.coordinates as CoordinateArray;
                const vertices = DrawableObject.createVerticesFromCoordinates(coordinates);
                object.setVertices(vertices);
            } else if (isPolygonGeometry(geometry) && object instanceof DrawPolygon) {
                if (geometry.coordinates.length > 0) {
                    const coordinates = geometry.coordinates[0] as CoordinateArray;
                    const vertices = DrawableObject.createVerticesFromCoordinates(coordinates);
                    object.setVertices(vertices);
                }
            }
        } catch (error) {
            console.error("Error updating object from geometry:", error);
        }
    }
}

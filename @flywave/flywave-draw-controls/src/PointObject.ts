/* Copyright (C) 2025 flywave.gl contributors */

import {
    type FeatureGeometry,
    type Point as GeoJsonPoint
} from "@flywave/flywave-datasource-protocol";
import { GeoCoordinates } from "@flywave/flywave-geoutils";
import { type MapView } from "@flywave/flywave-mapview";
import * as THREE from "three";

import { DrawableObject } from "./DrawableObject";
import { DrawMaterialFactory } from "./DrawMaterialFactory";
import { type DrawPointGeometry, DrawableType } from "./DrawTypes";

/**
 * 点纹理缓存
 * 使用 Map 缓存已创建的纹理，避免重复创建
 */
const textureCache = new Map<string, THREE.Texture>();

/**
 * 点绘制对象类
 *
 * 职责：
 * - 管理点对象的几何体和视觉表现（精灵和选中环）
 * - 处理顶点状态（普通/顶点标记）
 * - 响应选中/编辑状态变化
 * - 纹理创建和缓存管理
 * - 材质创建委托给 DrawMaterialFactory（单一职责）
 */
export class PointObject extends DrawableObject {
    /**
     * 精灵对象
     */
    private readonly sprite: THREE.Sprite;

    /**
     * 精灵材质引用
     */
    private spriteMaterial: THREE.SpriteMaterial;

    /**
     * 选中环网格（仅普通点有）
     */
    private readonly ringMesh: THREE.Mesh | null;

    /**
     * 是否为顶点标记（区别于独立点）
     */
    public readonly isVertex: boolean;

    /**
     * 基础颜色
     */
    private readonly baseColor: number;

    /**
     * 环材质引用
     */
    private ringMaterial: THREE.MeshBasicMaterial | null;

    /**
     * 构造函数
     *
     * @param mapView - 地图视图实例
     * @param position - 点位置坐标
     * @param isVertex - 是否为顶点标记（默认 false）
     * @param id - 可选的对象 ID
     */
    constructor(
        mapView: MapView,
        position: GeoCoordinates,
        isVertex: boolean = false,
        id?: string
    ) {
        super(mapView, id);
        this.vertices = [position];
        this.isVertex = isVertex;
        this.baseColor = isVertex
            ? DrawMaterialFactory.getVertexColor()
            : DrawMaterialFactory.getPointColor();

        const texture = this.createPointTexture(this.baseColor, false, isVertex, false);
        this.spriteMaterial = DrawMaterialFactory.createSpriteMaterial(texture);
        this.sprite = new THREE.Sprite(this.spriteMaterial);

        this.userData.isVertex = isVertex;
        this.userData.isVertexPoint = true;

        const scale = isVertex ? 0.008 : 0.015;
        this.sprite.scale.set(scale, scale, 1);
        this.sprite.renderOrder = 100;

        this.ringMaterial = null;
        this.ringMesh = null;

        if (!isVertex) {
            const ringGeometry = new THREE.RingGeometry(1.5, 1.7, 32);
            this.ringMaterial = DrawMaterialFactory.createRingMaterial();
            this.ringMesh = new THREE.Mesh(ringGeometry, this.ringMaterial);
            this.ringMesh.rotation.x = Math.PI / 2;
            this.ringMesh.renderOrder = 99;
            this.add(this.ringMesh);
        }

        this.add(this.sprite);
        this.update();
    }

    /**
     * 获取绘制对象类型
     * @returns 点对象类型标识
     */
    public getDrawableType(): DrawableType {
        return DrawableType.POINT;
    }

    /**
     * 创建点纹理
     *
     * @param color - 颜色值
     * @param isSelected - 是否选中
     * @param isVertex - 是否为顶点标记
     * @param isEditing - 是否编辑状态
     * @returns CanvasTexture 实例
     *
     * 说明：使用缓存机制避免重复创建相同纹理
     */
    protected createPointTexture(
        color: number,
        isSelected: boolean = false,
        isVertex: boolean = false,
        isEditing: boolean = false
    ): THREE.Texture {
        const cacheKey = `${color}-${isSelected}-${isVertex}-${isEditing}`;

        const cachedTexture = textureCache.get(cacheKey);
        if (cachedTexture) {
            return cachedTexture;
        }

        const canvas = document.createElement("canvas");
        const baseSize = isVertex ? 64 : 80;
        const size = isSelected || isEditing ? baseSize * 1.3 : baseSize;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error("Failed to get 2D rendering context");
        }

        context.clearRect(0, 0, size, size);

        const center = size / 2;

        if (isSelected) {
            context.strokeStyle = "#ffd700";
            context.lineWidth = size / 8;
            context.beginPath();
            context.arc(center, center, size / 2 - size / 16, 0, Math.PI * 2);
            context.stroke();

            context.strokeStyle = "#ffd700";
            context.lineWidth = size / 8;
            context.beginPath();
            context.arc(center, center, size / 4, 0, Math.PI * 2);
            context.stroke();
        } else if (isEditing) {
            context.strokeStyle = "#ffa500";
            context.lineWidth = size / 8;
            context.beginPath();
            context.arc(center, center, size / 2 - size / 16, 0, Math.PI * 2);
            context.stroke();

            context.strokeStyle = "#ffa500";
            context.lineWidth = size / 8;
            context.beginPath();
            context.arc(center, center, size / 4, 0, Math.PI * 2);
            context.stroke();
        } else {
            context.strokeStyle = "#ffff00";
            context.lineWidth = size / 8;
            context.beginPath();
            context.arc(center, center, size / 2 - size / 16, 0, Math.PI * 2);
            context.stroke();

            context.strokeStyle = "#ffff00";
            context.lineWidth = size / 8;
            context.beginPath();
            context.arc(center, center, size / 4, 0, Math.PI * 2);
            context.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        textureCache.set(cacheKey, texture);

        return texture;
    }

    /**
     * 创建轮廓对象（点对象不需要轮廓）
     */
    protected createOutlineObject(): void {
        // 点对象不需要轮廓
    }

    /**
     * 更新顶点位置
     * @param index - 顶点索引（点对象固定为 0）
     * @param newVertex - 新的顶点坐标
     */
    public updateVertex(index: number, newVertex: GeoCoordinates): void {
        if (index === 0 && this.vertices.length > 0) {
            this.vertices[0] = newVertex;
            this.update();
        }
    }

    /**
     * 移动点到新位置
     * @param newPosition - 新的位置坐标
     */
    public moveTo(newPosition: GeoCoordinates): void {
        if (this.vertices.length > 0) {
            this.vertices[0] = new GeoCoordinates(
                newPosition.latitude,
                newPosition.longitude,
                newPosition.altitude !== undefined ? newPosition.altitude : this.vertices[0].altitude
            );
            this.update();
        }
    }

    /**
     * 获取点的中心点坐标（即点本身）
     * @returns 点的坐标
     */
    public getCenter(): GeoCoordinates {
        return this.vertices.length > 0 ? this.vertices[0] : new GeoCoordinates(0, 0);
    }

    /**
     * 更新点显示
     */
    public update(): void {
        if (this.vertices.length > 0) {
            const position = this.mapView.projection.projectPoint(
                this.vertices[0],
                new THREE.Vector3()
            );
            this.position.copy(position);
        }
    }

    /**
     * 更新点视觉效果
     * 响应选中/编辑状态变化
     */
    protected updateVisuals(): void {
        let displayColor = this.baseColor;

        if (this.isSelected) {
            displayColor = DrawMaterialFactory.getSelectedColor();
        } else if (this.isEditing) {
            displayColor = DrawMaterialFactory.getEditingColor();
        }

        const oldMaterial = this.spriteMaterial;
        const texture = this.createPointTexture(
            displayColor,
            this.isSelected,
            this.isVertex,
            this.isEditing
        );
        this.spriteMaterial = DrawMaterialFactory.createSpriteMaterial(texture);
        this.sprite.material = this.spriteMaterial;

        DrawMaterialFactory.disposeMaterial(oldMaterial);

        if (this.ringMesh && this.ringMaterial) {
            this.ringMaterial.opacity = this.isSelected ? 0.8 : 0;
        }
    }

    /**
     * 更新悬停状态
     * @param isHovered - 是否悬停
     *
     * 状态保护逻辑：仅当顶点未选中时才允许清除高亮悬停状态
     */
    public updateHoverState(isHovered: boolean): void {
        if (!isHovered && this.isSelected) {
            return;
        }
    }

    /**
     * 转换为 GeoJSON 格式
     * @returns 类型化的 Point GeoJSON 对象
     */
    public toGeoJSON(): DrawPointGeometry {
        return {
            type: "Point",
            coordinates: [
                this.vertices[0].longitude,
                this.vertices[0].latitude,
                this.vertices[0].altitude || 0
            ]
        };
    }

    /**
     * 设置顶点选中状态
     * @param index - 顶点索引（点对象固定为 0）
     * @param selected - 是否选中
     */
    public setVertexSelected(index: number, selected: boolean): void {
        if (index === 0) {
            this.setSelected(selected);
        }
    }

    /**
     * 获取顶点选中状态
     * @param index - 顶点索引（点对象固定为 0）
     * @returns 是否选中
     */
    public getVertexSelected(index: number): boolean {
        return index === 0 ? this.isSelected : false;
    }

    /**
     * 设置高度
     * @param height - 高度值
     */
    public setHeight(height: number): void {
        if (this.vertices.length > 0) {
            this.vertices[0].altitude = height;
            this.update();
        }
    }

    /**
     * 获取高度
     * @returns 高度值
     */
    public getHeight(): number {
        return this.vertices.length > 0 ? this.vertices[0].altitude || 0 : 0;
    }

    /**
     * 设置编辑状态
     * @param editing - 是否处于编辑状态
     */
    public setEditing(editing: boolean): void {
        this.isEditing = editing;
        this.updateVisuals();
    }

    /**
     * 获取编辑状态
     * @returns 是否处于编辑状态
     */
    public getEditing(): boolean {
        return this.isEditing;
    }

    /**
     * 获取精灵材质
     * @returns SpriteMaterial 实例
     */
    get material(): THREE.SpriteMaterial {
        return this.spriteMaterial;
    }

    /**
     * 从 GeoJSON 创建点对象
     *
     * @param mapView - 地图视图实例
     * @param geoJson - GeoJSON Point 几何体
     * @param id - 可选的对象 ID
     * @returns PointObject 实例或 null
     */
    public static fromGeoJSON(
        mapView: MapView,
        geoJson: GeoJsonPoint,
        id?: string
    ): PointObject | null {
        if (!geoJson || geoJson.type !== "Point" || !geoJson.coordinates) {
            return null;
        }

        try {
            const coordinates = geoJson.coordinates;
            const position = new GeoCoordinates(
                coordinates[1],
                coordinates[0],
                coordinates[2] || 0
            );

            return new PointObject(mapView, position, false, id);
        } catch (error) {
            console.error("Error creating PointObject from GeoJSON:", error);
            return null;
        }
    }

    /**
     * 释放点资源
     */
    public dispose(): void {
        DrawMaterialFactory.disposeMaterial(this.spriteMaterial);

        if (this.ringMesh) {
            DrawMaterialFactory.disposeGeometry(this.ringMesh.geometry);
            DrawMaterialFactory.disposeMaterial(this.ringMesh.material);
        }

        this.removeFromParent();
        super.dispose();
    }
}

/**
 * 清理点纹理缓存
 * 释放所有缓存的纹理资源
 */
export const clearPointTextureCache = (): void => {
    textureCache.forEach(texture => {
        texture.dispose();
    });
    textureCache.clear();
};

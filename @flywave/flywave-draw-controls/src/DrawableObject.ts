/* Copyright (C) 2025 flywave.gl contributors */

import { type FeatureGeometry } from "@flywave/flywave-datasource-protocol";
import { GeoCoordinates } from "@flywave/flywave-geoutils";
import { type MapView, MapViewEventNames } from "@flywave/flywave-mapview";
import * as THREE from "three";

import { DrawMaterialFactory } from "./DrawMaterialFactory";
import {
    type CoordinateArray,
    type DrawGeometry,
    type DrawableType,
    isObjectWithGeometry
} from "./DrawTypes";

/**
 * 可绘制对象抽象基类
 *
 * 设计原则：
 * 1. 单一职责 - 定义绘制对象的公共接口和基础行为
 * 2. 类型安全 - 所有方法和属性都有精确类型定义，杜绝 any 类型
 * 3. 开闭原则 - 通过抽象方法支持子类扩展
 * 4. 资源管理 - 统一的资源释放机制
 *
 * 所有具体绘制对象（点、线、多边形）都应继承此类
 */
export abstract class DrawableObject extends THREE.Object3D {
    /**
     * 对象是否被选中
     */
    public isSelected: boolean = false;

    /**
     * 对象是否处于编辑状态
     */
    public isEditing: boolean = false;

    /**
     * 地图视图引用
     */
    protected readonly mapView: MapView;

    /**
     * 轮廓对象
     */
    protected outlineObject: THREE.Object3D | null = null;

    /**
     * 顶点坐标数组
     */
    protected vertices: GeoCoordinates[] = [];

    /**
     * 对象唯一标识符
     */
    public readonly id: number;

    /**
     * 静态 ID 计数器
     */
    private static nextId: number = 1;

    /**
     * 相机位置变化事件处理函数引用
     */
    private readonly doCameraPositionChanged: () => void;

    /**
     * 构造函数
     *
     * @param mapView - 地图视图实例
     * @param id - 可选的对象 ID，如不提供则自动生成
     */
    constructor(mapView: MapView, id?: string) {
        super();
        this.mapView = mapView;
        this.id = DrawableObject.nextId++;

        this.doCameraPositionChanged = () => {
            this.onCameraPositionChanged();
        };

        mapView.addEventListener(
            MapViewEventNames.CameraPositionChanged,
            this.doCameraPositionChanged
        );
    }

    /**
     * 获取绘制对象类型
     * 子类必须实现此方法以返回具体类型
     */
    public abstract getDrawableType(): DrawableType;

    /**
     * 相机位置变化回调
     * 子类可重写此方法以响应相机变化
     */
    protected onCameraPositionChanged(): void {
        // 默认空实现
    }

    /**
     * 创建轮廓对象
     * 子类必须实现此方法
     */
    protected abstract createOutlineObject(): void;

    /**
     * 设置顶点选中状态
     * @param index - 顶点索引
     * @param selected - 是否选中
     */
    public abstract setVertexSelected(index: number, selected: boolean): void;

    /**
     * 获取顶点选中状态
     * @param index - 顶点索引
     * @returns 是否选中
     */
    public abstract getVertexSelected(index: number): boolean;

    /**
     * 更新对象显示
     */
    public abstract update(): void;

    /**
     * 转换为 GeoJSON 几何体
     * @returns 类型化的 GeoJSON 几何体对象
     */
    public abstract toGeoJSON(): DrawGeometry;

    /**
     * 更新顶点位置
     * @param index - 顶点索引
     * @param newVertex - 新的顶点坐标
     */
    public abstract updateVertex(index: number, newVertex: GeoCoordinates): void;

    /**
     * 移动整个对象到新位置
     * @param newPosition - 新的位置坐标
     */
    public abstract moveTo(newPosition: GeoCoordinates): void;

    /**
     * 获取对象的中心点坐标
     * @returns 对象的中心点坐标
     */
    public abstract getCenter(): GeoCoordinates;

    /**
     * 更新对象视觉效果
     * 子类必须实现此方法以响应选中/编辑状态变化
     */
    protected abstract updateVisuals(): void;

    /**
     * 获取 THREE.js 对象
     * @returns THREE.Object3D 实例
     */
    public getObject3D(): THREE.Object3D {
        return this;
    }

    /**
     * 设置对象顶点
     * @param vertices - 顶点坐标数组
     */
    public setVertices(vertices: GeoCoordinates[]): void {
        this.vertices = [...vertices];
        this.update();
    }

    /**
     * 获取对象顶点
     * @returns 顶点坐标数组的副本
     */
    public getVertices(): GeoCoordinates[] {
        return [...this.vertices];
    }

    /**
     * 添加顶点
     * @param vertex - 要添加的顶点坐标
     */
    public addVertex(vertex: GeoCoordinates): void {
        this.vertices.push(vertex);
        this.update();
    }

    /**
     * 移除顶点
     * @param index - 要移除的顶点索引
     */
    public removeVertex(index: number): void {
        if (index >= 0 && index < this.vertices.length) {
            this.vertices.splice(index, 1);
            this.update();
        }
    }

    /**
     * 设置对象选中状态
     * @param selected - 是否选中
     */
    public setSelected(selected: boolean): void {
        if (this.isSelected !== selected) {
            this.isSelected = selected;
            this.updateVisuals();
        }
    }

    /**
     * 设置对象编辑状态
     * @param editing - 是否处于编辑状态
     */
    public setEditing(editing: boolean): void {
        if (this.isEditing !== editing) {
            this.isEditing = editing;
            this.updateVisuals();
        }
    }

    /**
     * 获取对象选中状态
     * @returns 是否选中
     */
    public getSelected(): boolean {
        return this.isSelected;
    }

    /**
     * 获取对象编辑状态
     * @returns 是否处于编辑状态
     */
    public getEditing(): boolean {
        return this.isEditing;
    }

    /**
     * 一次性更新对象状态（选中和编辑）
     * @param isSelected - 是否选中
     * @param isEditing - 是否处于编辑状态
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
     * 释放对象资源
     * 包括：移除事件监听、清理轮廓、从父节点移除
     */
    public dispose(): void {
        this.mapView.removeEventListener(
            MapViewEventNames.CameraPositionChanged,
            this.doCameraPositionChanged
        );

        if (this.outlineObject) {
            this.remove(this.outlineObject);
            this.disposeObjectResources(this.outlineObject);
            this.outlineObject = null;
        }

        this.removeFromParent();
    }

    /**
     * 安全释放 THREE.Object3D 的几何体和材质资源
     *
     * @param object - 待释放资源的 THREE 对象
     *
     * 说明：使用类型守卫替代 any 类型转换，确保类型安全
     */
    protected disposeObjectResources(object: THREE.Object3D): void {
        if (isObjectWithGeometry(object)) {
            DrawMaterialFactory.disposeGeometry(object.geometry);
            DrawMaterialFactory.disposeMaterial(object.material);
        }
    }

    /**
     * 从坐标数组创建 GeoCoordinates 数组
     *
     * @param coordinates - 坐标数组，支持二维和三维坐标元组
     * @returns GeoCoordinates 数组
     *
     * 说明：使用精确的 CoordinateArray 类型替代 any[]
     */
    public static createVerticesFromCoordinates(coordinates: CoordinateArray): GeoCoordinates[] {
        return coordinates.map(coord => {
            if (Array.isArray(coord) && coord.length >= 2) {
                return new GeoCoordinates(
                    coord[1],
                    coord[0],
                    coord[2] !== undefined ? coord[2] : 0
                );
            }
            return new GeoCoordinates(0, 0);
        });
    }

    /**
     * 从 GeoJSON 几何体创建顶点数组
     *
     * @param geometry - GeoJSON 几何体对象
     * @returns GeoCoordinates 数组
     */
    protected static verticesFromGeometry(geometry: FeatureGeometry): GeoCoordinates[] {
        switch (geometry.type) {
            case "Point":
                return DrawableObject.createVerticesFromCoordinates([
                    geometry.coordinates as CoordinateArray[number]
                ]);
            case "LineString":
                return DrawableObject.createVerticesFromCoordinates(
                    geometry.coordinates as CoordinateArray
                );
            case "Polygon":
                if (geometry.coordinates.length > 0) {
                    return DrawableObject.createVerticesFromCoordinates(
                        geometry.coordinates[0] as CoordinateArray
                    );
                }
                return [];
            default:
                return [];
        }
    }
}

/* Copyright (C) 2025 flywave.gl contributors */

import { GeoCoordinates } from "@flywave/flywave-geoutils";
import { type MapView } from "@flywave/flywave-mapview";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";

import { DrawableObject } from "./DrawableObject";
import { DrawMaterialFactory } from "./DrawMaterialFactory";
import { type DrawLineStringGeometry, DrawableType, type VertexPointUserData } from "./DrawTypes";
import { PointObject } from "./PointObject";

/**
 * 线绘制对象类
 *
 * 职责：
 * - 管理线对象的几何体和视觉表现
 * - 处理顶点管理和更新
 * - 响应选中/编辑状态变化
 * - 材质创建委托给 DrawMaterialFactory（单一职责）
 */
export class DrawLine extends DrawableObject {
    /**
     * 轮廓线对象
     */
    protected outlineLine: Line2 | null = null;

    /**
     * 主线对象
     */
    protected line: Line2;

    /**
     * 线容器（用于局部坐标变换）
     */
    protected readonly lineContainer: THREE.Object3D;

    /**
     * 基础线宽
     */
    protected baseLineWidth: number = 2;

    /**
     * 线颜色
     */
    protected lineColor: number = 0xffff00;

    /**
     * 顶点可视化点数组
     */
    protected vertexPoints: PointObject[] = [];

    /**
     * 线材质引用（用于动态更新）
     */
    protected lineMaterial: LineMaterial;

    /**
     * 构造函数
     *
     * @param mapView - 地图视图实例
     * @param vertices - 顶点坐标数组
     * @param id - 可选的对象 ID
     */
    constructor(mapView: MapView, vertices: GeoCoordinates[] = [], id?: string) {
        super(mapView, id);
        this.vertices = [...vertices];

        const geometry = new LineGeometry();
        this.lineMaterial = this.createLineMaterial(this.lineColor, this.baseLineWidth);

        this.line = new Line2(geometry, this.lineMaterial);
        this.line.renderOrder = 1;

        this.lineContainer = new THREE.Object3D();
        this.lineContainer.add(this.line);
        this.add(this.lineContainer);

        this.createVertexPoints();
        this.createOutlineObject();
        this.update();
    }

    /**
     * 获取绘制对象类型
     * @returns 线对象类型标识
     */
    public getDrawableType(): DrawableType {
        return DrawableType.LINE;
    }

    /**
     * 创建线材质
     *
     * @param color - 线颜色
     * @param linewidth - 线宽
     * @returns LineMaterial 实例
     *
     * 说明：委托给 DrawMaterialFactory 统一创建材质
     */
    protected createLineMaterial(color: number, linewidth: number): LineMaterial {
        return DrawMaterialFactory.createLineMaterial({
            color,
            lineWidth: linewidth
        });
    }

    /**
     * 更新顶点位置
     * @param index - 顶点索引
     * @param newVertex - 新的顶点坐标
     */
    public updateVertex(index: number, newVertex: GeoCoordinates): void {
        if (index >= 0 && index < this.vertices.length) {
            this.vertices[index] = newVertex;

            if (index < this.vertexPoints.length) {
                this.vertexPoints[index].moveTo(newVertex);
                this.vertexPoints[index].update();
            }

            this.update();
        }
    }

    /**
     * 移动整个线到新位置
     * @param newPosition - 新的位置坐标
     */
    public moveTo(newPosition: GeoCoordinates): void {
        if (this.vertices.length === 0) return;

        const center = this.getCenter();
        const deltaLat = newPosition.latitude - center.latitude;
        const deltaLon = newPosition.longitude - center.longitude;

        for (let i = 0; i < this.vertices.length; i++) {
            const vertex = this.vertices[i];
            const newVertex = new GeoCoordinates(
                vertex.latitude + deltaLat,
                vertex.longitude + deltaLon,
                vertex.altitude
            );
            this.vertices[i] = newVertex;

            if (i < this.vertexPoints.length) {
                this.vertexPoints[i].moveTo(newVertex);
            }
        }

        this.update();
    }

    /**
     * 设置线顶点
     * @param vertices - 顶点坐标数组
     */
    public setVertices(vertices: GeoCoordinates[]): void {
        if (vertices.length < 2) return;

        this.vertices = [...vertices];
        this.createVertexPoints();
        this.update();
    }

    /**
     * 获取线的中心点坐标
     * @returns 线的中心点坐标
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
     * 更新线显示
     */
    public update(): void {
        if (!this.vertices || this.vertices.length < 2) {
            this.line.visible = false;
            return;
        } else {
            this.line.visible = true;
        }

        const center = this.getCenter();
        const centerProjected = this.mapView.projection.projectPoint(center);

        this.lineContainer.position.copy(centerProjected);

        const positions = this.vertices.map(vertex => {
            const projected = this.mapView.projection.projectPoint(vertex);
            return new THREE.Vector3(
                projected.x - centerProjected.x,
                projected.y - centerProjected.y,
                projected.z - centerProjected.z
            );
        });

        const vertices = positions.flatMap(pos => [pos.x, pos.y, pos.z]);
        const geometry = this.line.geometry as LineGeometry;
        geometry.setPositions(vertices);

        if (this.vertexPoints.length !== this.vertices.length) {
            this.createVertexPoints();
        } else {
            for (let i = 0; i < this.vertices.length; i++) {
                if (i < this.vertexPoints.length) {
                    this.vertexPoints[i].moveTo(this.vertices[i]);
                    this.vertexPoints[i].update();
                }
            }
        }

        this.updateVisuals();
    }

    /**
     * 设置顶点选中状态
     * @param index - 顶点索引
     * @param selected - 是否选中
     */
    public setVertexSelected(index: number, selected: boolean): void {
        if (index >= 0 && index < this.vertexPoints.length) {
            this.vertexPoints[index].setSelected(selected);

            if (selected) {
                this.vertexPoints[index].setEditing(true);
            } else {
                this.vertexPoints[index].setEditing(false);
            }
        }
    }

    /**
     * 获取顶点选中状态
     * @param index - 顶点索引
     * @returns 是否选中
     */
    public getVertexSelected(index: number): boolean {
        return index >= 0 && index < this.vertexPoints.length
            ? this.vertexPoints[index].isSelected
            : false;
    }

    /**
     * 更新线视觉效果
     * 响应选中/编辑状态变化
     */
    protected updateVisuals(): void {
        if (this.isSelected) {
            this.lineMaterial.color.set(DrawMaterialFactory.getSelectedColor());
            this.lineMaterial.linewidth = this.baseLineWidth * 2;

            this.vertexPoints.forEach(point => {
                point.setSelected(true);
            });
        } else {
            this.lineMaterial.color.set(this.lineColor);
            this.lineMaterial.linewidth = this.baseLineWidth;

            this.vertexPoints.forEach(point => {
                point.setSelected(false);
                point.setEditing(false);
            });
        }
    }

    /**
     * 转换为 GeoJSON 格式
     * @returns 类型化的 LineString GeoJSON 对象
     */
    public toGeoJSON(): DrawLineStringGeometry {
        return {
            type: "LineString",
            coordinates: this.vertices.map(vertex => [
                vertex.longitude,
                vertex.latitude,
                vertex.altitude || 0
            ])
        };
    }

    /**
     * 释放线资源
     */
    public dispose(): void {
        super.dispose();

        if (this.lineContainer.parent) {
            this.lineContainer.parent.remove(this.lineContainer);
        }

        DrawMaterialFactory.disposeGeometry(this.line.geometry);
        DrawMaterialFactory.disposeMaterial(this.line.material);

        this.vertexPoints.forEach(point => {
            point.dispose();
        });
        this.vertexPoints = [];

        if (this.outlineLine) {
            DrawMaterialFactory.disposeGeometry(this.outlineLine.geometry);
            DrawMaterialFactory.disposeMaterial(this.outlineLine.material);
            this.outlineLine = null;
        }
    }

    /**
     * 获取顶点可视化点数组
     * @returns PointObject 数组
     */
    public getVertexPoints(): PointObject[] {
        return [...this.vertexPoints];
    }

    /**
     * 创建轮廓对象
     */
    protected createOutlineObject(): void {
        const mainGeometry = this.line.geometry;
        const material = this.createOutlineMaterial();

        this.outlineLine = new Line2(mainGeometry, material);
        this.outlineLine.renderOrder = -10;
        this.outlineLine.raycast = () => {};

        this.lineContainer.add(this.outlineLine);
    }

    /**
     * 创建轮廓材质
     * @returns LineMaterial 实例
     *
     * 说明：委托给 DrawMaterialFactory 统一创建材质
     */
    protected createOutlineMaterial(): LineMaterial {
        return DrawMaterialFactory.createOutlineMaterial();
    }

    /**
     * 创建顶点可视化点
     */
    protected createVertexPoints(): void {
        this.vertexPoints.forEach(point => {
            this.remove(point.getObject3D());
            point.dispose();
        });
        this.vertexPoints = [];

        for (let i = 0; i < this.vertices.length; i++) {
            const vertexPoint = this.createVertexPoint(this.vertices[i], true);

            const userData: VertexPointUserData = {
                isVertexPoint: true,
                isVertex: true,
                vertexIndex: i,
                parentObject: this
            };
            vertexPoint.getObject3D().userData = userData;

            this.vertexPoints.push(vertexPoint);
            this.add(vertexPoint.getObject3D());
        }
    }

    /**
     * 创建顶点可视化点对象
     *
     * @param position - 顶点位置
     * @param isVertex - 是否为顶点
     * @returns PointObject 实例
     *
     * 工厂方法，允许子类重写
     */
    protected createVertexPoint(position: GeoCoordinates, isVertex: boolean): PointObject {
        return new PointObject(this.mapView, position, isVertex);
    }
}

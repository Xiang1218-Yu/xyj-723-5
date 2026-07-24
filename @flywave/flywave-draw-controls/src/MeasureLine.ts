/* Copyright (C) 2025 flywave.gl contributors */

import { type GeoCoordinates } from "@flywave/flywave-geoutils";
import { type MapView } from "@flywave/flywave-mapview";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";

import { DrawLine } from "./DrawLine";
import { DrawMaterialFactory } from "./DrawMaterialFactory";
import { DrawableType } from "./DrawTypes";

/**
 * 测量线类
 *
 * 职责：
 * - 继承 DrawLine 的线绘制功能
 * - 添加距离计算和测量显示功能
 * - 使用专用的测量线材质样式
 * - 材质创建委托给 DrawMaterialFactory（单一职责）
 */
export class MeasureLine extends DrawLine {
    /**
     * 箭头线数组（预留功能）
     */
    private arrowLines: Line2[] = [];

    /**
     * 标准化设备坐标顶点数组
     */
    private ndcVertexs: THREE.Vector3[] = [];

    /**
     * 测量距离（米）
     */
    private distance: number = 0;

    /**
     * 构造函数
     *
     * @param mapView - 地图视图实例
     * @param vertices - 顶点坐标数组
     * @param id - 可选的对象 ID
     */
    constructor(mapView: MapView, vertices: GeoCoordinates[] = [], id?: string) {
        super(mapView, vertices, id);
        this.updateMeasureDisplay();
    }

    /**
     * 获取绘制对象类型
     * @returns 测量线对象类型标识
     */
    public getDrawableType(): DrawableType {
        return DrawableType.MEASURE_LINE;
    }

    /**
     * 相机位置变化回调
     * 更新 NDC 坐标
     */
    protected onCameraPositionChanged(): void {
        this.vertices.forEach((geo, index) => {
            const v = this.mapView.getScreenPosition(geo);
            if (!this.ndcVertexs[index]) {
                this.ndcVertexs[index] = new THREE.Vector3();
            }
            this.ndcVertexs[index].set(
                v.x / this.mapView.canvas.width,
                v.y / this.mapView.canvas.height,
                0
            );
        });
    }

    /**
     * 更新测量显示
     */
    public update(): void {
        super.update();
        this.updateMeasureDisplay();
    }

    /**
     * 更新测量显示元素
     */
    private updateMeasureDisplay(): void {
        if (!this.vertices || this.vertices.length < 2) {
            if (this.arrowLines.length > 0) {
                this.arrowLines.forEach(arrow => {
                    arrow.visible = false;
                });
            }
            return;
        }

        this.distance = this.calculateDistance();

        this.ndcVertexs = this.vertices.map(geo => {
            const v = this.mapView.getScreenPosition(geo);
            return new THREE.Vector3(
                v.x / this.mapView.canvas.width,
                v.y / this.mapView.canvas.height,
                0
            );
        });
    }

    /**
     * 计算线段总距离
     * @returns 距离（米）
     */
    private calculateDistance(): number {
        if (!this.vertices || this.vertices.length < 2) {
            return 0;
        }

        let totalDistance = 0;
        for (let i = 1; i < this.vertices.length; i++) {
            const prevVertex = this.vertices[i - 1];
            const currentVertex = this.vertices[i];
            totalDistance += this.calculateSegmentDistance(prevVertex, currentVertex);
        }

        return totalDistance;
    }

    /**
     * 计算两点间距离（Haversine 公式）
     *
     * @param point1 - 第一个点
     * @param point2 - 第二个点
     * @returns 距离（米）
     */
    private calculateSegmentDistance(point1: GeoCoordinates, point2: GeoCoordinates): number {
        const R = 6371e3;
        const lat1 = (point1.latitude * Math.PI) / 180;
        const lat2 = (point2.latitude * Math.PI) / 180;
        const deltaLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
        const deltaLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;

        const a =
            Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * 格式化距离显示
     *
     * @param distance - 距离（米）
     * @returns 格式化后的距离字符串
     */
    public formatDistance(distance: number): string {
        if (distance < 1) {
            return `${(distance * 100).toFixed(1)} cm`;
        } else if (distance < 1000) {
            return `${distance.toFixed(1)} m`;
        } else {
            return `${(distance / 1000).toFixed(2)} km`;
        }
    }

    /**
     * 更新线视觉效果
     * 重写父类方法，保持箭头可见
     */
    protected updateVisuals(): void {
        super.updateVisuals();

        if (this.arrowLines.length > 0) {
            this.arrowLines.forEach(arrow => {
                arrow.visible = true;
            });
        }
    }

    /**
     * 创建线材质
     * 重写父类方法，使用测量线专用样式（黑色虚线）
     *
     * @returns LineMaterial 实例
     *
     * 说明：委托给 DrawMaterialFactory 统一创建材质
     */
    protected createLineMaterial(): LineMaterial {
        return DrawMaterialFactory.createMeasureLineMaterial();
    }

    /**
     * 创建轮廓材质
     * 重写父类方法，使用测量线轮廓样式（白色虚线）
     *
     * @returns LineMaterial 实例
     *
     * 说明：委托给 DrawMaterialFactory 统一创建材质
     */
    protected createOutlineMaterial(): LineMaterial {
        return DrawMaterialFactory.createMeasureLineOutlineMaterial();
    }

    /**
     * 获取测量距离
     * @returns 距离（米）
     */
    public getDistance(): number {
        return this.distance;
    }

    /**
     * 释放资源
     */
    public dispose(): void {
        if (this.arrowLines.length > 0) {
            this.arrowLines.forEach(arrow => {
                this.remove(arrow);
                DrawMaterialFactory.disposeGeometry(arrow.geometry);
                DrawMaterialFactory.disposeMaterial(arrow.material);
            });
            this.arrowLines = [];
        }

        super.dispose();
    }
}

/* Copyright (C) 2025 flywave.gl contributors */

import { GeoCoordinates } from "@flywave/flywave-geoutils";
import { type MapView } from "@flywave/flywave-mapview";
import earcut from "earcut";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";

import { DrawableObject } from "./DrawableObject";
import { DrawMaterialFactory } from "./DrawMaterialFactory";
import { type DrawPolygonGeometry, DrawableType, type OutlineUserData, type VertexPointUserData } from "./DrawTypes";
import { PointObject } from "./PointObject";

/**
 * 多边形绘制对象类
 *
 * 职责：
 * - 管理多边形填充、轮廓和边的几何体与视觉表现
 * - 处理顶点管理和更新
 * - 响应选中/编辑状态变化
 * - 材质创建委托给 DrawMaterialFactory（单一职责）
 */
export class DrawPolygon extends DrawableObject {
    /**
     * 多边形网格对象
     */
    protected mesh: THREE.Mesh;

    /**
     * 外轮廓线
     */
    protected outline: Line2;

    /**
     * 填充颜色
     */
    protected fillColor: number = 0x00ff00;

    /**
     * 轮廓颜色
     */
    protected outlineColor: number = 0x0000ff;

    /**
     * 透明度
     */
    protected opacity: number = 0.6;

    /**
     * 顶点可视化点数组
     */
    protected verticesPoints: PointObject[] = [];

    /**
     * 内部边数组
     */
    protected edges: Line2[] = [];

    /**
     * 轮廓边数组（选中时显示）
     */
    protected outlineEdges: Line2[] = [];

    /**
     * 填充材质引用
     */
    protected meshMaterial: THREE.MeshPhongMaterial;

    /**
     * 轮廓材质引用
     */
    protected outlineMaterial: LineMaterial;

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

        const geometry = new THREE.BufferGeometry();
        this.meshMaterial = this.createPolygonMaterial(this.fillColor, this.opacity);

        this.mesh = new THREE.Mesh(geometry, this.meshMaterial);
        this.mesh.renderOrder = 0;

        const outlineGeometry = new LineGeometry();
        this.outlineMaterial = this.createOutlineMaterial(this.outlineColor);

        this.outline = new Line2(outlineGeometry, this.outlineMaterial);
        this.outline.renderOrder = 2;

        this.add(this.mesh);
        this.add(this.outline);

        this.createEdges();
        this.createOutlineObject();

        this.update();
    }

    /**
     * 获取绘制对象类型
     * @returns 多边形对象类型标识
     */
    public getDrawableType(): DrawableType {
        return DrawableType.POLYGON;
    }

    /**
     * 创建多边形填充材质
     *
     * @param color - 填充颜色
     * @param opacity - 透明度
     * @returns MeshPhongMaterial 实例
     *
     * 说明：委托给 DrawMaterialFactory 统一创建材质
     */
    protected createPolygonMaterial(color: number, opacity: number): THREE.MeshPhongMaterial {
        return DrawMaterialFactory.createPolygonMaterial({
            color,
            opacity
        });
    }

    /**
     * 创建多边形轮廓材质
     *
     * @param color - 轮廓颜色
     * @returns LineMaterial 实例
     *
     * 说明：委托给 DrawMaterialFactory 统一创建材质
     */
    protected createOutlineMaterial(color: number): LineMaterial {
        return DrawMaterialFactory.createPolygonOutlineMaterial({
            color
        });
    }

    /**
     * 创建内部边
     */
    private createEdges(): void {
        this.edges.forEach(edge => this.remove(edge));
        this.edges = [];

        for (let i = 0; i < this.vertices.length; i++) {
            const geometry = new LineGeometry();
            const material = DrawMaterialFactory.createPolygonEdgeMaterial();

            const line = new Line2(geometry, material);
            line.renderOrder = 1;
            this.edges.push(line);
            this.add(line);
        }
    }

    /**
     * 创建轮廓对象（选中状态的高亮轮廓）
     */
    protected createOutlineObject(): void {
        this.outlineEdges.forEach(edge => this.remove(edge));
        this.outlineEdges = [];

        for (let i = 0; i < this.vertices.length; i++) {
            const geometry = new LineGeometry();
            const material = this.createOutlineEdgeMaterial();

            const line = new Line2(geometry, material);
            line.visible = false;
            line.renderOrder = 999;

            const userData: OutlineUserData = {
                isOutline: true
            };
            line.userData = userData;
            line.raycast = () => {};

            this.outlineEdges.push(line);
            this.add(line);
        }
    }

    /**
     * 创建轮廓边材质
     *
     * @returns LineMaterial 实例
     *
     * 说明：委托给 DrawMaterialFactory 统一创建材质
     */
    protected createOutlineEdgeMaterial(): LineMaterial {
        return DrawMaterialFactory.createOutlineEdgeMaterial();
    }

    /**
     * 更新轮廓边
     */
    protected updateOutline(): void {
        if (this.vertices.length < 3) return;

        const worldVertices = this.vertices.map(vertex =>
            this.mapView.projection.projectPoint(vertex)
        );

        for (let i = 0; i < this.vertices.length; i++) {
            const nextIndex = (i + 1) % this.vertices.length;
            const positions = [
                worldVertices[i].x,
                worldVertices[i].y,
                worldVertices[i].z,
                worldVertices[nextIndex].x,
                worldVertices[nextIndex].y,
                worldVertices[nextIndex].z
            ];

            if (i < this.outlineEdges.length) {
                (this.outlineEdges[i].geometry as LineGeometry).setPositions(positions);
            }
        }
    }

    /**
     * 创建顶点和边
     */
    private createVerticesAndEdges(): void {
        this.verticesPoints.forEach(point => this.remove(point.getObject3D()));
        this.verticesPoints = [];

        for (let i = 0; i < this.vertices.length; i++) {
            const vertexPoint = this.createVertexPoint(this.vertices[i], true);
            this.verticesPoints.push(vertexPoint);
            this.add(vertexPoint.getObject3D());
        }

        this.createEdges();
        this.createOutlineObject();
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

    /**
     * 更新顶点位置
     * @param index - 顶点索引
     * @param newVertex - 新的顶点坐标
     */
    public updateVertex(index: number, newVertex: GeoCoordinates): void {
        if (index >= 0 && index < this.vertices.length) {
            this.vertices[index] = newVertex;
            this.update();
        }
    }

    /**
     * 移动整个多边形到新位置
     * @param newPosition - 新的位置坐标
     */
    public moveTo(newPosition: GeoCoordinates): void {
        if (this.vertices.length === 0) return;

        const center = this.getCenter();
        const deltaLat = newPosition.latitude - center.latitude;
        const deltaLon = newPosition.longitude - center.longitude;

        this.vertices = this.vertices.map(
            vertex =>
                new GeoCoordinates(
                    vertex.latitude + deltaLat,
                    vertex.longitude + deltaLon,
                    vertex.altitude
                )
        );
        this.update();
    }

    /**
     * 获取多边形的中心点坐标
     * @returns 多边形的中心点坐标
     */
    public getCenter(): GeoCoordinates {
        if (this.vertices.length === 0) {
            return new GeoCoordinates(0, 0);
        }

        let sumLat = 0;
        let sumLon = 0;
        let sumAlt = 0;

        this.vertices.forEach(vertex => {
            sumLat += vertex.latitude;
            sumLon += vertex.longitude;
            sumAlt += vertex.altitude || 0;
        });

        return new GeoCoordinates(
            sumLat / this.vertices.length,
            sumLon / this.vertices.length,
            sumAlt / this.vertices.length
        );
    }

    /**
     * 更新多边形显示
     */
    public update(): void {
        if (this.vertices.length < 3) return;

        const worldVertices = this.vertices.map(vertex =>
            this.mapView.projection.projectPoint(vertex)
        );

        const flattenedVertices = worldVertices.flatMap(v => [v.x, v.y, v.z]);
        const indices = earcut(flattenedVertices, null, 3);

        this.mesh.geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(flattenedVertices, 3)
        );
        this.mesh.geometry.setIndex(indices);
        this.mesh.geometry.computeVertexNormals();

        const outlineVertices = [...worldVertices, worldVertices[0]];
        const outlinePositions = outlineVertices.flatMap(v => [v.x, v.y, v.z]);
        (this.outline.geometry as LineGeometry).setPositions(outlinePositions);

        for (let i = 0; i < this.edges.length; i++) {
            if (i < worldVertices.length) {
                const nextIndex = (i + 1) % worldVertices.length;
                const edgePositions = [
                    worldVertices[i].x,
                    worldVertices[i].y,
                    worldVertices[i].z,
                    worldVertices[nextIndex].x,
                    worldVertices[nextIndex].y,
                    worldVertices[nextIndex].z
                ];
                (this.edges[i].geometry as LineGeometry).setPositions(edgePositions);
            }
        }

        this.updateOutline();

        for (let i = 0; i < this.verticesPoints.length && i < worldVertices.length; i++) {
            this.verticesPoints[i].position.copy(worldVertices[i]);
        }

        if (this.verticesPoints.length !== this.vertices.length) {
            this.createVerticesAndEdges();
        }
    }

    /**
     * 设置顶点选中状态
     * @param index - 顶点索引
     * @param selected - 是否选中
     */
    public setVertexSelected(index: number, selected: boolean): void {
        if (index >= 0 && index < this.verticesPoints.length) {
            this.verticesPoints[index].setSelected(selected);

            if (selected) {
                this.verticesPoints[index].setEditing(true);
            } else {
                this.verticesPoints[index].setEditing(false);
            }
        }
    }

    /**
     * 获取顶点选中状态
     * @param index - 顶点索引
     * @returns 是否选中
     */
    public getVertexSelected(index: number): boolean {
        return index >= 0 && index < this.verticesPoints.length
            ? this.verticesPoints[index].isSelected
            : false;
    }

    /**
     * 获取顶点可视化点数组
     * @returns PointObject 数组
     */
    public getVertexPoints(): PointObject[] {
        return [...this.verticesPoints];
    }

    /**
     * 更新多边形视觉效果
     * 响应选中/编辑状态变化
     */
    protected updateVisuals(): void {
        if (this.isSelected) {
            this.meshMaterial.color.set(DrawMaterialFactory.getSelectedColor());
            this.meshMaterial.emissive.set(DrawMaterialFactory.getSelectedColor());
            this.meshMaterial.emissiveIntensity = 0.3;
            this.outlineMaterial.color.set(DrawMaterialFactory.getEditingColor());
            this.meshMaterial.opacity = 0.8;
            this.outlineMaterial.linewidth = 4;

            this.verticesPoints.forEach(point => {
                point.setSelected(true);
            });
        } else {
            this.meshMaterial.color.set(this.fillColor);
            this.outlineMaterial.color.set(this.outlineColor);
            this.meshMaterial.opacity = this.opacity;
            this.outlineMaterial.linewidth = 3;

            this.verticesPoints.forEach(point => {
                point.setSelected(false);
                point.setEditing(false);
            });
        }
    }

    /**
     * 转换为 GeoJSON 格式
     * @returns 类型化的 Polygon GeoJSON 对象
     */
    public toGeoJSON(): DrawPolygonGeometry {
        return {
            type: "Polygon",
            coordinates: [
                this.vertices.map(vertex => [
                    vertex.longitude,
                    vertex.latitude,
                    vertex.altitude || 0
                ])
            ]
        };
    }

    /**
     * 释放多边形资源
     */
    public dispose(): void {
        this.outlineEdges.forEach(edge => {
            this.remove(edge);
            DrawMaterialFactory.disposeGeometry(edge.geometry);
            DrawMaterialFactory.disposeMaterial(edge.material);
        });
        this.outlineEdges = [];

        this.edges.forEach(edge => {
            this.remove(edge);
            DrawMaterialFactory.disposeGeometry(edge.geometry);
            DrawMaterialFactory.disposeMaterial(edge.material);
        });
        this.edges = [];

        DrawMaterialFactory.disposeGeometry(this.mesh.geometry);
        DrawMaterialFactory.disposeMaterial(this.mesh.material);
        DrawMaterialFactory.disposeGeometry(this.outline.geometry);
        DrawMaterialFactory.disposeMaterial(this.outline.material);

        this.verticesPoints.forEach(point => {
            point.dispose();
        });
        this.verticesPoints = [];

        super.dispose();
    }

    /**
     * 设置轮廓可见性
     * @param visible - 是否可见
     */
    public setOutlineVisible(visible: boolean): void {
        this.outlineEdges.forEach(edge => {
            edge.visible = visible;
        });
    }
}

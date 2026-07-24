/* Copyright (C) 2025 flywave.gl contributors */

import { ProjectionType } from "@flywave/flywave-geoutils";
import { type MapView } from "@flywave/flywave-mapview";
import * as THREE from "three";

import { DrawLine } from "./DrawLine";
import { DrawPolygon } from "./DrawPolygon";
import { HeightHandle } from "./HeightHandle";
import { type PointObject } from "./PointObject";

/**
 * 具有顶点的对象接口
 * 定义可以附加高度控制柄的绘制对象的公共接口
 */
interface VertexContainer {
    /** 获取所有顶点点 */
    getVertexPoints(): PointObject[];
}

/**
 * 类型守卫：检查对象是否为顶点容器（具有 getVertexPoints 方法）
 * @param obj - 待检查对象
 * @returns 是否为 VertexContainer
 */
function isVertexContainer(obj: unknown): obj is VertexContainer {
    return (
        obj !== null &&
        typeof obj === "object" &&
        typeof (obj as VertexContainer).getVertexPoints === "function"
    );
}

/**
 * 高度调整管理器类
 *
 * 职责：
 * - 管理高度控制柄（HeightHandle）的附加和分离
 * - 处理高度拖拽调整的交互逻辑
 * - 支持点对象和线/多边形顶点的高度调整
 * - 统一高度变化事件回调
 * - 类型安全的对象引用管理
 */
export class HeightAdjustManager extends THREE.Object3D {
    /**
     * 地图视图引用
     */
    private readonly mapView: MapView;

    /**
     * 高度控制柄
     */
    private readonly heightHandle: HeightHandle;

    /**
     * 当前附加的点对象
     */
    private currentPoint: PointObject | null = null;

    /**
     * 是否正在调整高度
     */
    private isAdjusting: boolean = false;

    /**
     * 拖拽起始点（屏幕坐标）
     */
    private readonly startPoint: THREE.Vector2 = new THREE.Vector2();

    /**
     * 起始高度
     */
    private startHeight: number = 0;

    /**
     * 调整平面（用于射线求交）
     */
    private readonly adjustmentPlane: THREE.Plane = new THREE.Plane();

    /**
     * 起始交点
     */
    private readonly startIntersection: THREE.Vector3 = new THREE.Vector3();

    /**
     * 高度变化回调
     */
    private readonly onHeightChanged?: (point: PointObject, newHeight: number) => void;

    /**
     * 构造函数
     *
     * @param mapView - 地图视图实例
     * @param onHeightChanged - 高度变化时的回调函数
     */
    constructor(
        mapView: MapView,
        onHeightChanged?: (point: PointObject, newHeight: number) => void
    ) {
        super();
        this.mapView = mapView;
        this.onHeightChanged = onHeightChanged;
        this.heightHandle = new HeightHandle();

        this.add(this.heightHandle);
        this.renderOrder = 1000;
    }

    /**
     * 将高度控制柄附加到点对象
     *
     * @param point - 目标点对象
     */
    public attachToPoint(point: PointObject): void {
        this.currentPoint = point;

        const worldPos = this.mapView.projection.projectPoint(point.getCenter());

        if (this.mapView.projection.type === ProjectionType.Spherical) {
            const normal = this.mapView.projection.surfaceNormal(worldPos, new THREE.Vector3());
            this.heightHandle.setDirection(normal);
        } else {
            this.heightHandle.setDirection(new THREE.Vector3(0, 0, 1));
        }

        this.heightHandle.updateSize(this.mapView.camera, this.mapView.renderer);
        this.heightHandle.setVisible(true);
        this.heightHandle.setHoverState(false);
        this.heightHandle.setActiveState(false);

        this.update();
    }

    /**
     * 获取当前顶点高度
     * @returns 当前高度或 null
     */
    public getCurrentVertexHeight(): number | null {
        return this.currentPoint ? this.currentPoint.getHeight() : null;
    }

    /**
     * 设置当前顶点高度
     * @param height - 新高度值
     */
    public setCurrentVertexHeight(height: number): void {
        if (this.currentPoint) {
            this.currentPoint.setHeight(height);
        }
    }

    /**
     * 分离当前点对象
     * 隐藏高度控制柄并重置状态
     */
    public detach(): void {
        this.currentPoint = null;
        this.heightHandle.setVisible(false);
        this.heightHandle.setHoverState(false);
        this.heightHandle.setActiveState(false);
        this.isAdjusting = false;
    }

    /**
     * 检查鼠标是否与高度控制柄交互
     *
     * @param mousePoint - 鼠标标准化设备坐标
     * @returns 是否交互
     */
    public checkInteraction(mousePoint: THREE.Vector2): boolean {
        if (!this.currentPoint) return false;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mousePoint, this.mapView.getRteCamera());

        const isIntersecting = this.heightHandle.checkIntersection(
            raycaster,
            this.mapView.getRteCamera()
        );
        this.heightHandle.setHoverState(isIntersecting);

        return isIntersecting;
    }

    /**
     * 使用已有的射线投射器检查高度控制柄交互
     *
     * @param raycaster - 射线投射器
     * @returns 是否交互
     */
    public checkHeightHandleInteraction(raycaster: THREE.Raycaster): boolean {
        if (!this.currentPoint || !this.heightHandle.isVisible) {
            return false;
        }

        return this.heightHandle.checkIntersection(raycaster, this.mapView.getRteCamera());
    }

    /**
     * 获取高度控制柄的世界位置
     * @returns 世界位置或 null
     */
    public getHeightHandleWorldPosition(): THREE.Vector3 | null {
        if (!this.currentPoint) {
            return null;
        }

        const position = new THREE.Vector3();
        this.heightHandle.getWorldPosition(position);
        return position;
    }

    /**
     * 将高度控制柄附加到线或多边形的顶点
     *
     * @param vertexContainer - 包含顶点的对象（DrawLine 或 DrawPolygon）
     * @param vertexIndex - 顶点索引
     *
     * 说明：使用类型守卫和联合类型替代 any，确保类型安全
     */
    public attachToLineVertex(
        vertexContainer: DrawLine | DrawPolygon | VertexContainer,
        vertexIndex: number
    ): void {
        if (!isVertexContainer(vertexContainer) || vertexIndex < 0) {
            this.detach();
            return;
        }

        const vertexPoints = vertexContainer.getVertexPoints();
        if (vertexIndex >= vertexPoints.length) {
            this.detach();
            return;
        }

        const vertexPoint = vertexPoints[vertexIndex];
        this.attachToPoint(vertexPoint);
    }

    /**
     * 开始高度调整
     *
     * @param event - 鼠标事件
     * @returns 是否成功开始调整
     */
    public startAdjustment(event: MouseEvent): boolean {
        if (!this.currentPoint) return false;

        const mousePoint = new THREE.Vector2(
            (event.offsetX / this.mapView.canvas.width) * 2 - 1,
            -(event.offsetY / this.mapView.canvas.height) * 2 + 1
        );

        if (this.checkInteraction(mousePoint)) {
            this.isAdjusting = true;
            this.startPoint.set(event.clientX, event.clientY);
            this.startHeight = this.currentPoint.getHeight();
            this.heightHandle.setActiveState(true);

            const arrowDirection = this.heightHandle.getDirection();
            const handleWorldPos = new THREE.Vector3();
            this.heightHandle.getWorldPosition(handleWorldPos);

            const startRaycaster = new THREE.Raycaster();
            startRaycaster.setFromCamera(mousePoint, this.mapView.getRteCamera());

            const cameraDirection = new THREE.Vector3();
            this.mapView.camera.getWorldDirection(cameraDirection);

            this.adjustmentPlane.setFromNormalAndCoplanarPoint(cameraDirection, handleWorldPos);

            if (!startRaycaster.ray.intersectPlane(this.adjustmentPlane, this.startIntersection)) {
                console.warn("Unable to calculate initial intersection point, using backup method");
                startRaycaster.ray.closestPointToPoint(handleWorldPos, this.startIntersection);
            }

            event.stopPropagation();
            return true;
        }

        return false;
    }

    /**
     * 处理高度调整（拖拽中）
     *
     * @param event - 鼠标事件
     */
    public handleAdjustment(event: MouseEvent): void {
        if (!this.isAdjusting || !this.currentPoint) return;

        const currentMousePoint = new THREE.Vector2(
            (event.offsetX / this.mapView.canvas.width) * 2 - 1,
            -(event.offsetY / this.mapView.canvas.height) * 2 + 1
        );

        const currentRaycaster = new THREE.Raycaster();
        currentRaycaster.setFromCamera(currentMousePoint, this.mapView.getRteCamera());

        const currentIntersection = new THREE.Vector3();
        if (currentRaycaster.ray.intersectPlane(this.adjustmentPlane, currentIntersection)) {
            const arrowDirection = this.heightHandle.getDirection();
            const displacement = currentIntersection.clone().sub(this.startIntersection);
            const heightDelta = displacement.dot(arrowDirection);
            const newHeight = this.startHeight + heightDelta;

            this.currentPoint.setHeight(newHeight);

            if (this.onHeightChanged) {
                this.onHeightChanged(this.currentPoint, newHeight);
            }

            this.update();
        }
    }

    /**
     * 处理滚轮高度调整
     *
     * @param event - 滚轮事件
     * @returns 是否处理了事件
     */
    public handleWheelAdjustment(event: WheelEvent): boolean {
        if (!this.currentPoint) return false;

        const mousePoint = new THREE.Vector2(
            (event.offsetX / this.mapView.canvas.width) * 2 - 1,
            -(event.offsetY / this.mapView.canvas.height) * 2 + 1
        );

        if (this.checkInteraction(mousePoint)) {
            const currentHeight = this.currentPoint.getHeight();
            const wheelSensitivity = 0.5;
            const delta = -event.deltaY * wheelSensitivity;
            const newHeight = currentHeight + delta;

            this.currentPoint.setHeight(newHeight);
            event.preventDefault();
            return true;
        }

        return false;
    }

    /**
     * 结束高度调整
     */
    public endAdjustment(): void {
        this.isAdjusting = false;
        this.heightHandle.setActiveState(false);
    }

    /**
     * 更新方法（每帧调用）
     * 同步控制柄位置和尺寸
     */
    public update(): void {
        if (this.currentPoint && this.heightHandle.isVisible) {
            const worldPos = this.mapView.projection.projectPoint(this.currentPoint.getCenter());
            this.heightHandle.position.copy(worldPos);
            this.heightHandle.updateSize(this.mapView.camera, this.mapView.renderer);
        }
    }

    /**
     * 释放资源
     */
    public dispose(): void {
        this.heightHandle.dispose();
        this.removeFromParent();
    }

    /**
     * 获取当前点对象
     * @returns 当前点对象或 null
     */
    public getCurrentPoint(): PointObject | null {
        return this.currentPoint;
    }

    /**
     * 获取是否正在调整
     * @returns 是否正在调整高度
     */
    public getIsAdjusting(): boolean {
        return this.isAdjusting;
    }

    /**
     * 获取高度控制柄
     * @returns HeightHandle 实例
     */
    public getHeightHandle(): HeightHandle {
        return this.heightHandle;
    }
}

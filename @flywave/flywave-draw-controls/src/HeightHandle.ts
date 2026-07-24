/* Copyright (C) 2025 flywave.gl contributors */

import * as THREE from "three";

import { FixedSizeArrow } from "./FixedSizeArrow";

/**
 * 高度控制柄类
 *
 * 职责：
 * - 提供用于高度调整的可视化箭头控制柄
 * - 管理控制柄的可见性、悬停和激活状态
 * - 在屏幕空间保持固定尺寸
 * - 支持方向设置和射线检测
 * - 类型安全的状态管理
 */
export class HeightHandle extends THREE.Object3D {
    /**
     * 是否可见
     */
    public isVisible: boolean = false;

    /**
     * 是否悬停
     */
    public isHovered: boolean = false;

    /**
     * 是否激活（正在拖拽）
     */
    public isActive: boolean = false;

    /**
     * 固定尺寸箭头组件
     */
    private readonly arrow: FixedSizeArrow;

    /**
     * 屏幕空间目标尺寸（像素）
     */
    private readonly pixelSize: number = 32;

    /**
     * 构造函数
     */
    constructor() {
        super();

        this.arrow = new FixedSizeArrow({
            size: this.pixelSize,
            headColor: 0x00ff00,
            shaftColor: 0x00ff00,
            visible: false,
            opacity: 1.0
        });

        this.arrow.renderOrder = 10;
        this.add(this.arrow);

        this.raycast = () => {};
        this.arrow.raycast = () => {};

        this.visible = false;
    }

    /**
     * 设置可见性
     * @param visible - 是否可见
     */
    public setVisible(visible: boolean): void {
        this.isVisible = visible;
        this.visible = visible;
        this.arrow.visible = visible;

        if (visible) {
            this.updateAppearance();
            this.setOpacity(0.8);
        } else {
            this.setOpacity(0);
        }
    }

    /**
     * 更新尺寸（根据相机距离保持屏幕空间固定大小）
     * @param camera - 相机
     * @param renderer - 渲染器（可选）
     */
    public updateSize(camera: THREE.Camera, renderer?: THREE.WebGLRenderer): void {
        this.arrow.updateSize(camera, renderer);
    }

    /**
     * 设置悬停状态
     * @param hovered - 是否悬停
     */
    public setHoverState(hovered: boolean): void {
        this.isHovered = hovered;
        this.updateAppearance();
    }

    /**
     * 设置激活状态
     * @param active - 是否激活
     */
    public setActiveState(active: boolean): void {
        this.isActive = active;
        this.updateAppearance();
    }

    /**
     * 更新外观（颜色和透明度）
     * 根据当前状态设置箭头颜色
     */
    private updateAppearance(): void {
        let headColor: number;
        let shaftColor: number;
        let opacity: number;

        if (this.isActive) {
            headColor = 0xffff00;
            shaftColor = 0xffff00;
            opacity = 1.0;
        } else if (this.isHovered) {
            headColor = 0x00ffff;
            shaftColor = 0x00ffff;
            opacity = 0.9;
        } else {
            headColor = 0x00ff00;
            shaftColor = 0x00ff00;
            opacity = 0.8;
        }

        this.arrow.setHeadColor(headColor);
        this.arrow.setShaftColor(shaftColor);
        this.arrow.setOpacity(opacity);
    }

    /**
     * 设置不透明度
     * @param opacity - 不透明度
     */
    private setOpacity(opacity: number): void {
        this.arrow.setOpacity(opacity);
    }

    /**
     * 检查与射线的交互（使用精确几何体检测）
     *
     * @param raycaster - 射线投射器
     * @param camera - 相机
     * @returns 是否有交互
     */
    public checkIntersection(raycaster: THREE.Raycaster, camera: THREE.Camera): boolean {
        if (!this.isVisible) return false;

        const intersects: THREE.Intersection[] = [];
        raycaster.intersectObject(this.arrow, true, intersects);

        return intersects.length > 0;
    }

    /**
     * 释放资源
     */
    public dispose(): void {
        this.arrow.dispose();
        this.removeFromParent();
    }

    /**
     * 设置箭头方向
     *
     * @param normal - 法向量（目标方向）
     *
     * 说明：计算从默认方向 (0,1,0) 到目标方向的旋转四元数
     */
    public setDirection(normal: THREE.Vector3): void {
        const defaultDirection = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion();

        if (normal.length() > 0) {
            normal.normalize();
            quaternion.setFromUnitVectors(defaultDirection, normal);
        } else {
            quaternion.set(0, 0, 0, 1);
        }

        this.quaternion.copy(quaternion);
    }

    /**
     * 获取箭头当前方向
     * @returns 方向向量
     */
    public getDirection(): THREE.Vector3 {
        const direction = new THREE.Vector3(0, 1, 0);
        direction.applyQuaternion(this.quaternion);
        return direction;
    }
}

/* Copyright (C) 2025 flywave.gl contributors */

import * as THREE from "three";

/**
 * 固定尺寸箭头组件选项接口
 */
export interface FixedSizeArrowOptions {
    /** 箭头尺寸（像素） */
    size?: number;
    /** 箭头头部颜色 */
    headColor?: THREE.ColorRepresentation;
    /** 箭杆颜色 */
    shaftColor?: THREE.ColorRepresentation;
    /** 是否可见 */
    visible?: boolean;
    /** 不透明度 (0-1) */
    opacity?: number;
}

/**
 * 固定尺寸箭头组件用户数据接口
 * 用于类型安全的用户数据访问
 */
interface FixedSizeArrowUserData {
    /** 是否为固定尺寸箭头标记 */
    isFixedSizeArrow: true;
}

/**
 * 固定尺寸箭头组件
 *
 * 职责：
 * - 继承 THREE.Object3D，在屏幕空间保持固定尺寸
 * - 管理箭头头部和箭杆的几何体与材质
 * - 根据相机距离自动缩放以保持屏幕尺寸恒定
 * - 类型安全的属性访问，消除 any 类型
 */
export class FixedSizeArrow extends THREE.Object3D {
    /**
     * 默认选项常量
     */
    private static readonly DEFAULT_OPTIONS: Required<FixedSizeArrowOptions> = {
        size: 40,
        headColor: 0xe65c00,
        shaftColor: 0xf9d423,
        visible: true,
        opacity: 1.0
    };

    /**
     * 当前尺寸（像素）
     */
    private _size: number;

    /**
     * 箭头头部颜色
     */
    private _headColor: THREE.Color;

    /**
     * 箭杆颜色
     */
    private _shaftColor: THREE.Color;

    /**
     * 不透明度
     */
    private _opacity: number;

    /**
     * 箭头头部网格
     */
    private _headMesh: THREE.Mesh | null = null;

    /**
     * 箭杆网格
     */
    private _shaftMesh: THREE.Mesh | null = null;

    /**
     * 合并后的选项
     */
    private readonly _options: Required<FixedSizeArrowOptions>;

    /**
     * 类型安全的用户数据
     */
    public override userData: FixedSizeArrowUserData;

    /**
     * 创建固定尺寸箭头
     *
     * @param options - 箭头配置选项
     */
    constructor(options: FixedSizeArrowOptions = {}) {
        super();

        this._options = { ...FixedSizeArrow.DEFAULT_OPTIONS, ...options };

        this._size = this._options.size;
        this._headColor = new THREE.Color(this._options.headColor);
        this._shaftColor = new THREE.Color(this._options.shaftColor);
        this._opacity = this._options.opacity;

        this.userData = {
            isFixedSizeArrow: true
        };

        this.createArrowGeometry();
    }

    /**
     * 创建箭头几何体
     * 内部方法，初始化头部和箭杆
     */
    private createArrowGeometry(): void {
        this.clear();

        const headLength = 0.6;
        const headWidth = 0.4;
        const shaftLength = 0.8;
        const shaftWidth = 0.1;

        const headGeometry = new THREE.ConeGeometry(headWidth / 2, headLength, 8);
        const headMaterial = new THREE.MeshBasicMaterial({
            color: this._headColor,
            transparent: this._opacity < 1,
            opacity: this._opacity,
            depthTest: false
        });

        this._headMesh = new THREE.Mesh(headGeometry, headMaterial);
        this._headMesh.position.y = shaftLength + headLength / 2;
        this.add(this._headMesh);

        const shaftGeometry = new THREE.CylinderGeometry(
            shaftWidth / 2,
            shaftWidth / 2,
            shaftLength,
            8
        );
        const shaftMaterial = new THREE.MeshBasicMaterial({
            color: this._shaftColor,
            transparent: this._opacity < 1,
            opacity: this._opacity,
            depthTest: false
        });

        this._shaftMesh = new THREE.Mesh(shaftGeometry, shaftMaterial);
        this._shaftMesh.position.y = shaftLength / 2;
        this.add(this._shaftMesh);
    }

    /**
     * 更新箭头尺寸以保持屏幕空间固定大小
     *
     * @param camera - 相机对象
     * @param renderer - 渲染器（可选，用于更精确的尺寸计算）
     */
    public updateSize(camera: THREE.Camera, renderer?: THREE.WebGLRenderer): void {
        if (!camera) return;

        const worldPos = new THREE.Vector3().setFromMatrixPosition(this.matrixWorld);
        const distance = worldPos.length();
        let scaleFactor: number;

        if (camera instanceof THREE.PerspectiveCamera) {
            const fov = camera.fov * (Math.PI / 180);
            const screenHeight = 2 * Math.tan(fov / 2) * distance;
            const canvasHeight = renderer?.domElement.height ?? window.innerHeight;
            scaleFactor = (this._size / canvasHeight) * screenHeight;
        } else if (camera instanceof THREE.OrthographicCamera) {
            const zoom = camera.zoom;
            const canvasHeight = renderer?.domElement.height ?? window.innerHeight;
            scaleFactor = (this._size * zoom) / canvasHeight;

            const height = camera.top - camera.bottom;
            scaleFactor *= height;
        } else {
            scaleFactor = (distance * this._size) / 1000;
        }

        this.scale.set(scaleFactor, scaleFactor, scaleFactor);
    }

    /**
     * 设置箭头尺寸
     * @param size - 新尺寸（像素）
     */
    public setSize(size: number): void {
        if (this._size !== size) {
            this._size = Math.max(1, size);
        }
    }

    /**
     * 获取箭头尺寸
     * @returns 当前尺寸（像素）
     */
    public getSize(): number {
        return this._size;
    }

    /**
     * 设置箭头头部颜色
     * @param color - 颜色值
     */
    public setHeadColor(color: THREE.ColorRepresentation): void {
        this._headColor = new THREE.Color(color);
        if (this._headMesh && this._headMesh.material instanceof THREE.MeshBasicMaterial) {
            this._headMesh.material.color.copy(this._headColor);
        }
    }

    /**
     * 获取箭头头部颜色
     * @returns 头部颜色副本
     */
    public getHeadColor(): THREE.Color {
        return this._headColor.clone();
    }

    /**
     * 设置箭杆颜色
     * @param color - 颜色值
     */
    public setShaftColor(color: THREE.ColorRepresentation): void {
        this._shaftColor = new THREE.Color(color);
        if (this._shaftMesh && this._shaftMesh.material instanceof THREE.MeshBasicMaterial) {
            this._shaftMesh.material.color.copy(this._shaftColor);
        }
    }

    /**
     * 获取箭杆颜色
     * @returns 箭杆颜色副本
     */
    public getShaftColor(): THREE.Color {
        return this._shaftColor.clone();
    }

    /**
     * 设置箭头不透明度
     * @param opacity - 不透明度 (0-1)
     */
    public setOpacity(opacity: number): void {
        this._opacity = THREE.MathUtils.clamp(opacity, 0, 1);

        if (this._headMesh && this._headMesh.material instanceof THREE.MeshBasicMaterial) {
            this._headMesh.material.opacity = this._opacity;
            this._headMesh.material.transparent = this._opacity < 1;
        }

        if (this._shaftMesh && this._shaftMesh.material instanceof THREE.MeshBasicMaterial) {
            this._shaftMesh.material.opacity = this._opacity;
            this._shaftMesh.material.transparent = this._opacity < 1;
        }
    }

    /**
     * 获取不透明度
     * @returns 当前不透明度
     */
    public getOpacity(): number {
        return this._opacity;
    }

    /**
     * 销毁箭头，释放资源
     */
    public dispose(): void {
        if (this._headMesh) {
            this._headMesh.geometry.dispose();
            this.disposeMaterial(this._headMesh.material);
        }

        if (this._shaftMesh) {
            this._shaftMesh.geometry.dispose();
            this.disposeMaterial(this._shaftMesh.material);
        }

        this.clear();
    }

    /**
     * 安全释放材质资源
     * @param material - 材质或材质数组
     */
    private disposeMaterial(material: THREE.Material | THREE.Material[]): void {
        if (Array.isArray(material)) {
            material.forEach(mat => mat.dispose());
        } else {
            material.dispose();
        }
    }

    /**
     * 类型守卫：检查对象是否为 FixedSizeArrow
     * @param obj - 待检查对象
     * @returns 是否为 FixedSizeArrow 实例
     */
    public static isFixedSizeArrow(obj: unknown): obj is FixedSizeArrow {
        return (
            obj instanceof FixedSizeArrow ||
            (obj !== null &&
                typeof obj === "object" &&
                (obj as { userData?: FixedSizeArrowUserData }).userData?.isFixedSizeArrow === true)
        );
    }
}

/**
 * 固定尺寸箭头系统
 *
 * 职责：
 * - 管理多个 FixedSizeArrow 实例
 * - 统一更新所有箭头的尺寸
 * - 类型安全的箭头集合管理
 */
export class FixedSizeArrowSystem {
    /**
     * 箭头集合
     */
    private readonly _arrows = new Set<FixedSizeArrow>();

    /**
     * 相机引用
     */
    private _camera: THREE.Camera | null = null;

    /**
     * 渲染器引用
     */
    private _renderer: THREE.WebGLRenderer | null = null;

    /**
     * 创建箭头系统
     *
     * @param camera - 相机
     * @param renderer - 渲染器（可选）
     */
    constructor(camera: THREE.Camera, renderer?: THREE.WebGLRenderer) {
        this._camera = camera;
        this._renderer = renderer ?? null;
    }

    /**
     * 向系统添加箭头
     * @param arrow - FixedSizeArrow 实例
     */
    public add(arrow: FixedSizeArrow): void {
        this._arrows.add(arrow);
    }

    /**
     * 从系统移除箭头
     * @param arrow - FixedSizeArrow 实例
     */
    public remove(arrow: FixedSizeArrow): void {
        this._arrows.delete(arrow);
    }

    /**
     * 检查是否包含指定箭头
     * @param arrow - FixedSizeArrow 实例
     * @returns 是否包含
     */
    public has(arrow: FixedSizeArrow): boolean {
        return this._arrows.has(arrow);
    }

    /**
     * 获取所有箭头
     * @returns 箭头数组副本
     */
    public getArrows(): FixedSizeArrow[] {
        return Array.from(this._arrows);
    }

    /**
     * 清空所有箭头
     */
    public clear(): void {
        this._arrows.clear();
    }

    /**
     * 更新所有箭头的尺寸
     */
    public update(): void {
        if (!this._camera) return;

        this._arrows.forEach(arrow => {
            if (FixedSizeArrow.isFixedSizeArrow(arrow)) {
                arrow.updateSize(this._camera!, this._renderer ?? undefined);
            }
        });
    }

    /**
     * 设置相机
     * @param camera - 相机实例
     */
    public setCamera(camera: THREE.Camera): void {
        this._camera = camera;
    }

    /**
     * 获取当前相机
     * @returns 相机实例或 null
     */
    public getCamera(): THREE.Camera | null {
        return this._camera;
    }

    /**
     * 设置渲染器
     * @param renderer - 渲染器实例
     */
    public setRenderer(renderer: THREE.WebGLRenderer): void {
        this._renderer = renderer;
    }

    /**
     * 获取当前渲染器
     * @returns 渲染器实例或 null
     */
    public getRenderer(): THREE.WebGLRenderer | null {
        return this._renderer;
    }

    /**
     * 销毁系统，释放所有资源
     */
    public dispose(): void {
        this._arrows.forEach(arrow => {
            arrow.dispose();
        });
        this.clear();
        this._camera = null;
        this._renderer = null;
    }
}

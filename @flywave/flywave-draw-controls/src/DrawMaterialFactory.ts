/* Copyright (C) 2025 flywave.gl contributors */

import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";

import {
    type LineMaterialOptions,
    type OutlineMaterialOptions,
    type PointMaterialOptions,
    type PolygonMaterialOptions
} from "./DrawTypes";

/**
 * 绘制材质工厂类
 *
 * 单一职责：统一管理所有绘制对象的材质创建，提供类型安全的材质创建接口
 *
 * 设计原则：
 * 1. 单一职责 - 仅负责材质创建，不包含其他业务逻辑
 * 2. 类型安全 - 所有方法都有精确的参数和返回类型
 * 3. 可扩展性 - 通过选项接口支持材质自定义
 * 4. 资源复用 - 支持材质缓存机制（未来扩展）
 */
export class DrawMaterialFactory {
    /**
     * 默认线材质颜色（黄色）
     */
    private static readonly DEFAULT_LINE_COLOR: number = 0xffff00;

    /**
     * 默认线宽
     */
    private static readonly DEFAULT_LINE_WIDTH: number = 2;

    /**
     * 默认多边形填充颜色（绿色）
     */
    private static readonly DEFAULT_POLYGON_FILL_COLOR: number = 0x00ff00;

    /**
     * 默认多边形轮廓颜色（蓝色）
     */
    private static readonly DEFAULT_POLYGON_OUTLINE_COLOR: number = 0x0000ff;

    /**
     * 默认多边形透明度
     */
    private static readonly DEFAULT_POLYGON_OPACITY: number = 0.6;

    /**
     * 默认轮廓颜色（金色）
     */
    private static readonly DEFAULT_OUTLINE_COLOR: number = 0xffd700;

    /**
     * 默认点颜色（顶点 - 红色）
     */
    private static readonly DEFAULT_VERTEX_COLOR: number = 0xff6b6b;

    /**
     * 默认点颜色（普通点 - 青色）
     */
    private static readonly DEFAULT_POINT_COLOR: number = 0x4ecdc4;

    /**
     * 默认选中颜色（绿色）
     */
    private static readonly DEFAULT_SELECTED_COLOR: number = 0x00ff00;

    /**
     * 默认编辑颜色（黄色）
     */
    private static readonly DEFAULT_EDITING_COLOR: number = 0xffff00;

    /**
     * 创建线材质
     *
     * @param options - 线材质配置选项
     * @returns 配置好的 LineMaterial 实例
     *
     * @example
     * ```typescript
     * const material = DrawMaterialFactory.createLineMaterial({
     *   color: 0xff0000,
     *   lineWidth: 3,
     *   dashed: true
     * });
     * ```
     */
    public static createLineMaterial(options: LineMaterialOptions = {}): LineMaterial {
        const {
            color = DrawMaterialFactory.DEFAULT_LINE_COLOR,
            lineWidth = DrawMaterialFactory.DEFAULT_LINE_WIDTH,
            opacity = 1.0,
            dashed = false,
            dashSize = 0.8,
            gapSize = 0.4,
            transparent = true,
            depthTest = false,
            depthWrite = true,
            alphaToCoverage = true
        } = options;

        return new LineMaterial({
            color,
            linewidth: lineWidth,
            dashed,
            dashSize,
            gapSize,
            opacity,
            depthTest,
            depthWrite,
            transparent,
            alphaToCoverage
        });
    }

    /**
     * 创建多边形填充材质
     *
     * @param options - 多边形材质配置选项
     * @returns 配置好的 MeshPhongMaterial 实例
     *
     * @example
     * ```typescript
     * const material = DrawMaterialFactory.createPolygonMaterial({
     *   color: 0x00ff00,
     *   opacity: 0.5
     * });
     * ```
     */
    public static createPolygonMaterial(options: PolygonMaterialOptions = {}): THREE.MeshPhongMaterial {
        const {
            color = DrawMaterialFactory.DEFAULT_POLYGON_FILL_COLOR,
            opacity = DrawMaterialFactory.DEFAULT_POLYGON_OPACITY,
            transparent = true,
            side = THREE.DoubleSide,
            specular = 0x111111,
            shininess = 30,
            depthTest = true,
            depthWrite = true
        } = options;

        return new THREE.MeshPhongMaterial({
            color,
            opacity,
            transparent,
            side,
            specular,
            shininess,
            depthTest,
            depthWrite
        });
    }

    /**
     * 创建多边形轮廓材质
     *
     * @param options - 线材质配置选项
     * @returns 配置好的 LineMaterial 实例
     */
    public static createPolygonOutlineMaterial(options: LineMaterialOptions = {}): LineMaterial {
        const {
            color = DrawMaterialFactory.DEFAULT_POLYGON_OUTLINE_COLOR,
            lineWidth = 3,
            opacity = 1.0,
            transparent = true,
            depthTest = false,
            depthWrite = false
        } = options;

        return DrawMaterialFactory.createLineMaterial({
            color,
            lineWidth,
            opacity,
            transparent,
            depthTest,
            depthWrite,
            dashed: false
        });
    }

    /**
     * 创建多边形边材质（内部边）
     *
     * @returns 配置好的 LineMaterial 实例
     */
    public static createPolygonEdgeMaterial(): LineMaterial {
        return DrawMaterialFactory.createLineMaterial({
            color: 0x888888,
            lineWidth: 1,
            opacity: 1.0,
            transparent: true,
            depthTest: false
        });
    }

    /**
     * 创建选中状态轮廓材质
     *
     * @param options - 轮廓材质配置选项
     * @returns 配置好的 LineMaterial 实例
     */
    public static createOutlineMaterial(options: OutlineMaterialOptions = {}): LineMaterial {
        const {
            outlineColor = DrawMaterialFactory.DEFAULT_OUTLINE_COLOR,
            lineWidth = 3,
            opacity = 0.8,
            dashed = true,
            dashSize = 0.8,
            gapSize = 0.4,
            depthTest = false,
            depthWrite = false
        } = options;

        return DrawMaterialFactory.createLineMaterial({
            color: outlineColor,
            lineWidth,
            opacity,
            dashed,
            dashSize,
            gapSize,
            transparent: true,
            depthTest,
            depthWrite
        });
    }

    /**
     * 创建选中状态轮廓边材质（多边形用）
     *
     * @returns 配置好的 LineMaterial 实例
     */
    public static createOutlineEdgeMaterial(): LineMaterial {
        return DrawMaterialFactory.createLineMaterial({
            color: DrawMaterialFactory.DEFAULT_OUTLINE_COLOR,
            lineWidth: 2,
            opacity: 0.8,
            dashed: true,
            dashSize: 0.6,
            gapSize: 0.3,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
    }

    /**
     * 创建点精灵材质
     *
     * @param texture - 点纹理
     * @param options - 点材质配置选项
     * @returns 配置好的 SpriteMaterial 实例
     */
    public static createSpriteMaterial(
        texture: THREE.Texture,
        options: PointMaterialOptions = {}
    ): THREE.SpriteMaterial {
        const { opacity = 1.0, depthTest = false, depthWrite = false } = options;

        return new THREE.SpriteMaterial({
            map: texture,
            color: 0xffffff,
            transparent: true,
            opacity,
            sizeAttenuation: false,
            depthTest,
            depthWrite
        });
    }

    /**
     * 创建选中环材质
     *
     * @returns 配置好的 MeshBasicMaterial 实例
     */
    public static createRingMaterial(): THREE.MeshBasicMaterial {
        return new THREE.MeshBasicMaterial({
            color: DrawMaterialFactory.DEFAULT_EDITING_COLOR,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthTest: false
        });
    }

    /**
     * 创建测量线材质
     *
     * @returns 配置好的 LineMaterial 实例（黑色虚线）
     */
    public static createMeasureLineMaterial(): LineMaterial {
        return DrawMaterialFactory.createLineMaterial({
            color: 0x000000,
            lineWidth: 2,
            dashed: true,
            dashSize: 0.5,
            gapSize: 0.3,
            opacity: 1.0,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            alphaToCoverage: true
        });
    }

    /**
     * 创建测量线轮廓材质
     *
     * @returns 配置好的 LineMaterial 实例（白色虚线）
     */
    public static createMeasureLineOutlineMaterial(): LineMaterial {
        return DrawMaterialFactory.createLineMaterial({
            color: 0xffffff,
            lineWidth: 2,
            dashed: true,
            dashSize: 0.8,
            gapSize: 0.4,
            opacity: 0.8,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
    }

    /**
     * 获取顶点默认颜色
     *
     * @returns 顶点颜色值
     */
    public static getVertexColor(): number {
        return DrawMaterialFactory.DEFAULT_VERTEX_COLOR;
    }

    /**
     * 获取普通点默认颜色
     *
     * @returns 普通点颜色值
     */
    public static getPointColor(): number {
        return DrawMaterialFactory.DEFAULT_POINT_COLOR;
    }

    /**
     * 获取选中状态颜色
     *
     * @returns 选中状态颜色值
     */
    public static getSelectedColor(): number {
        return DrawMaterialFactory.DEFAULT_SELECTED_COLOR;
    }

    /**
     * 获取编辑状态颜色
     *
     * @returns 编辑状态颜色值
     */
    public static getEditingColor(): number {
        return DrawMaterialFactory.DEFAULT_EDITING_COLOR;
    }

    /**
     * 安全释放材质资源
     *
     * @param material - 待释放的材质或材质数组
     *
     * 说明：统一处理单个材质和材质数组的释放，避免类型错误
     */
    public static disposeMaterial(material: THREE.Material | THREE.Material[] | undefined): void {
        if (!material) {
            return;
        }

        if (Array.isArray(material)) {
            material.forEach(mat => mat.dispose());
        } else {
            material.dispose();
        }
    }

    /**
     * 安全释放几何体资源
     *
     * @param geometry - 待释放的几何体
     */
    public static disposeGeometry(geometry: THREE.BufferGeometry | undefined): void {
        if (geometry) {
            geometry.dispose();
        }
    }
}

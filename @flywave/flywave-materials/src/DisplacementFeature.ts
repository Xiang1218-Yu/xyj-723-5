/* Copyright (C) 2025 flywave.gl contributors */

import * as THREE from "three";

import { type TileDisplacementMap } from "./DisplacementMap";

/**
 * 构造实现 DisplacementFeature 的新实例时使用的参数
 */
export interface DisplacementFeatureParameters {
    /**
     * 用于沿法线方向顶点位移的纹理
     */
    displacementMap?: THREE.Texture;
    /** 位移贴图 UV 变换矩阵 */
    displacementMapUvMatrix?: THREE.Matrix3;
}

/**
 * 位移贴图功能接口
 *
 * 使用位移贴图在高程数据上叠加几何体的材质应实现此接口
 */
export interface DisplacementFeature {
    /** 位移贴图 */
    displacementMap: THREE.Texture | null;
    /** 位移贴图 UV 变换矩阵 */
    displacementMapUvMatrix?: THREE.Matrix3;
    /** 是否需要更新 */
    needsUpdate?: boolean;
}

/**
 * 类型守卫：判断给定材质是否支持用于高程叠加的位移贴图
 *
 * @param material - 要检查的材质
 * @returns 给定材质是否为 DisplacementFeature
 */
export function hasDisplacementFeature(material: unknown): material is DisplacementFeature {
    return (
        material !== null &&
        typeof material === "object" &&
        "displacementMap" in material
    );
}

/**
 * 将位移贴图设置到单个材质
 *
 * @param displacementMap - 表示用于叠加对象高程数据的纹理
 * @param material - 要更新的单个材质
 */
function setDisplacementMapToSingleMaterial(
    displacementMap: TileDisplacementMap | null,
    material: DisplacementFeature
): void {
    const newMap = displacementMap?.texture ?? null;
    if (material.displacementMap !== newMap) {
        material.displacementMap = newMap;
        material.displacementMapUvMatrix = displacementMap?.uvMatrix;
        material.needsUpdate = true;
        if (material.displacementMap !== null) {
            material.displacementMap.needsUpdate = true;
        }
    }
}

/**
 * 设置位移贴图到材质
 *
 * 支持单个材质或材质数组（THREE.Mesh 的 material 属性可以是 Material 或 Material[]）
 *
 * @param displacementMap - 表示用于叠加对象高程数据的纹理
 * @param material - 要更新的材质（单个材质或材质数组）
 */
export function setDisplacementMapToMaterial(
    displacementMap: TileDisplacementMap | null,
    material: THREE.Mesh["material"]
): void {
    if (Array.isArray(material)) {
        // 处理材质数组：遍历数组中的每个材质
        for (const mat of material) {
            if (hasDisplacementFeature(mat)) {
                setDisplacementMapToSingleMaterial(displacementMap, mat);
            }
        }
    } else if (hasDisplacementFeature(material)) {
        // 处理单个材质
        setDisplacementMapToSingleMaterial(displacementMap, material);
    }
}

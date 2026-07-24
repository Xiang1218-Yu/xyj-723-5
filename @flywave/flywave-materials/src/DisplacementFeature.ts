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
 * 判断给定材质是否支持用于高程叠加的位移贴图
 *
 * @param material - 要检查的材质
 * @returns 给定材质是否支持用于高程叠加的位移贴图
 */
export function hasDisplacementFeature(material: unknown): material is DisplacementFeature {
    return (
        material !== null &&
        typeof material === "object" &&
        "displacementMap" in material
    );
}

/**
 * 设置位移贴图到材质
 *
 * @param displacementMap - 表示用于叠加对象高程数据的纹理
 * @param material - 要更新的材质
 */
export function setDisplacementMapToMaterial(
    displacementMap: TileDisplacementMap | null,
    material: THREE.Mesh["material"]
): void {
    if (hasDisplacementFeature(material)) {
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
}

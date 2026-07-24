/* Copyright (C) 2025 flywave.gl contributors */

import { assert } from "@flywave/flywave-utils";
import * as THREE from "three";

/**
 * 布尔着色器 define 值常量
 * - TRUE: 空字符串（用于 #ifdef 检查）
 * - FALSE: undefined（不定义）
 */
export const DEFINE_BOOL_TRUE = "";
export const DEFINE_BOOL_FALSE = undefined;

/**
 * Shader defines 映射类型
 * 键为 define 名称，值可以是布尔值或数字
 */
export type ShaderDefines = Record<string, boolean | number | string | undefined>;

/**
 * 在另一个 shader include 后插入 shader include
 *
 * @param shaderContent - 原始 shader 字符串
 * @param shaderName - 要在其后插入的 shader 名称
 * @param insertedShaderName - 要插入的 shader 名称
 * @param addTab - 是否在插入前添加制表符
 * @returns 修改后的 shader 字符串
 */
export function insertShaderInclude(
    shaderContent: string,
    shaderName: string,
    insertedShaderName: string,
    addTab?: boolean
): string {
    const tabChar = addTab === true ? "\t" : "";

    const result = shaderContent.replace(
        `#include <${shaderName}>`,
        `#include <${shaderName}>
${tabChar}#include <${insertedShaderName}>`
    );
    return result;
}

/**
 * 强制混合接口
 * 标记一个材质始终启用混合
 */
export interface ForcedBlending {
    /**
     * 此材质无论 opacity 设置如何，始终启用 blending
     */
    forcedBlending?: true;
}

/**
 * 可混合材质类型
 * THREE.Material 或 ShaderMaterialParameters 与 ForcedBlending 的交叉类型
 */
export type BlendableMaterial = (THREE.Material | THREE.ShaderMaterialParameters) & ForcedBlending;

/**
 * 强制启用混合
 *
 * THREE.js 仅在 transparent 为 true 或设置了不同于 NormalBlending 的混合模式时才启用混合。
 * 由于我们不想设置 transparent 为 true 来打乱渲染顺序，我们设置 CustomBlending 使用与 NormalBlending 相同的参数。
 *
 * @param material - 应使用混合的材质
 * @note 此函数不应在材质传递给 WebGL 后的帧更新中使用。在这种情况下请使用 enableBlending。
 */
export function enforceBlending(material: BlendableMaterial): void {
    if (material.transparent) {
        return;
    }

    enableBlending(material);
    material.forcedBlending = true;
}

/**
 * 使用 THREE.CustomBlending 设置启用 alpha 混合
 *
 * 函数使用预定义模式之一启用混合，用于颜色和 alpha 分量：
 * - Src: SrcAlphaFactor, Dst: OneMinusSrcAlphaFactor
 * - Src: OneFactor, Dst: OneMinusSrcAlphaFactor
 * 当 material.premultipliedAlpha 为 true 时使用第二个混合方程
 *
 * @note 混合模式更改不需要材质更新
 * @see THREE.Material.needsUpdate
 * @param material - 要修改的材质或材质参数
 */
export function enableBlending(material: BlendableMaterial): void {
    if (material.transparent === true || material.forcedBlending === true) {
        return;
    }

    material.blending = THREE.CustomBlending;
    if (material.premultipliedAlpha === true) {
        material.blendSrc = THREE.OneFactor;
        material.blendDst = THREE.OneMinusSrcAlphaFactor;
        material.blendSrcAlpha = THREE.OneFactor;
        material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
    } else {
        material.blendSrc = THREE.SrcAlphaFactor;
        material.blendDst = THREE.OneMinusSrcAlphaFactor;
        material.blendSrcAlpha = THREE.OneFactor;
        material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
    }
}

/**
 * 使用 THREE.CustomBlending 模式禁用 alpha 混合，切换回 NormalBlending
 *
 * @note 混合模式更改不需要材质更新
 * @see THREE.Material.needsUpdate
 * @see enableBlending
 * @param material - 要修改的材质或材质参数
 */
export function disableBlending(material: BlendableMaterial): void {
    if (material.transparent === true || material.forcedBlending === true) {
        return;
    }

    material.blending = THREE.NormalBlending;
}

/**
 * 使用两种允许的语义设置材质 shader define
 *
 * 函数接受两种类型的值用于着色器预处理 define：
 * - boolean，简单的 true 或 false，将 define 设置为空字符串，
 *   此类 define 可以在 shader 中使用 #ifdef 语义处理：
 * ```
 * #ifdef SOME_DEFINE && !defined(OTHER_DEFINE)
 * // do something
 * #endif
 * ```
 *
 * - number，将 define 设置为显式值。您可以使用它来启用/禁用某些代码，
 *   甚至设置影响着色器数学计算的编译时常量：
 * ```
 * #if SOME_DEFINE_SWITCH && OTHER_DEFINE_SWITCH == 0
 * gl_FragColor = vec4(1, 1, 1, DEFINE_ALPHA)
 * #endif
 * ```
 * @note 使用 false 值设置 define 与使用数字值 0 设置不同。
 *
 * @param material - 将设置 shader define 的 THREE.ShaderMaterial
 * @param key - shader 中使用的 define 名称，例如 USE_FOG、COLOR_ALPHA 等
 * @param value - 要设置的值，数字或布尔值，指定是否应定义预处理 define
 * @returns 如果材质因 define 更改而被迫更新（重新编译），返回 true，
 *          如果 define 未更改则返回 false
 */
export function setShaderMaterialDefine(
    material: THREE.ShaderMaterial,
    key: string,
    value: boolean | number
): boolean {
    assert(
        material.defines !== undefined,
        "Do not use this function in ShaderMaterial derived c-tor."
    );
    const semanticValue = getShaderMaterialDefine(material, key);
    const needsUpdate = value !== semanticValue;
    if (!needsUpdate) {
        return false;
    }
    setShaderDefine(material.defines as ShaderDefines, key, value);
    material.needsUpdate = needsUpdate;
    return true;
}

/**
 * 获取 THREE.ShaderMaterial GPU 着色器预处理 define 的值
 *
 * 整个引擎中使用的语义假设预处理 define 可能只有二进制（已定义/未定义）或数值，
 * 这确保了着色器和材质代码的一致性
 * @note 如果具有 key 的 define 为 undefined，函数返回 false，
 * 如果已定义但不是数值则返回 true，否则返回数字。
 * @see setShaderMaterialDefine
 *
 * @param material - 访问 shader defines 的材质
 * @param key - define 名称（标识符）
 * @param fallbackValue - 材质 defines 尚未初始化时返回的值，默认为 false，
 *                        如果期望数值请提供自己的默认值
 */
export function getShaderMaterialDefine(
    material: THREE.ShaderMaterial,
    key: string,
    fallbackValue: boolean | number = false
): boolean | number {
    if (material.defines === undefined) {
        return fallbackValue;
    }
    return getShaderDefine(material.defines as ShaderDefines, key);
}

/**
 * 无论当前设置的值如何，设置 define 的新值
 *
 * 使用新的键值对更新 defines 映射，如果键已存在则覆盖其值。
 * 可用于在材质创建前（即在构造函数中）设置 THREE.ShaderMaterialParameters 的辅助函数
 *
 * @param defines - 键值映射中存储的 shader defines
 * @param key - 用于标识 define 的键
 * @param value - 要存储的值
 * @returns 如果 define 确实更改了返回 true，否则返回 false
 * @see setShaderMaterialDefine
 */
export function setShaderDefine(
    defines: ShaderDefines,
    key: string,
    value: boolean | number
): boolean {
    let updated = false;
    if (typeof value === "number") {
        updated = defines[key] !== value;
        defines[key] = value;
    } else if (value === true) {
        updated = defines[key] !== DEFINE_BOOL_TRUE;
        defines[key] = DEFINE_BOOL_TRUE;
    } else if (value === false && defines[key] !== undefined) {
        delete defines[key];
        updated = true;
    }
    return updated;
}

/**
 * 从 defines 映射获取 shader define 值
 *
 * 如果指定的 key 下没有值，函数返回 false，否则结果为 true 或数值（如果存储了数字）
 * @param defines - defines 映射
 * @param key - define 的标识符
 */
export function getShaderDefine(defines: ShaderDefines, key: string): boolean | number {
    const currentValue = defines[key];
    const semanticValue: boolean | number =
        currentValue === DEFINE_BOOL_FALSE
            ? false
            : currentValue === DEFINE_BOOL_TRUE
            ? true
            : (currentValue as boolean | number);
    return semanticValue;
}

/* Copyright (C) 2025 flywave.gl contributors */

import * as THREE from "three";

import type { ShaderDefines } from "./Utils";

export type { ShaderDefines };

/**
 * 着色器 Uniforms 映射类型
 * 键为 uniform 名称，值为 THREE.IUniform 对象
 */
export type ShaderUniforms = Record<string, THREE.IUniform>;

/**
 * THREE.js 着色器编译回调类型
 *
 * 在着色器程序编译前调用，允许修改顶点和片元着色器代码
 *
 * @param shader - 包含 uniforms、vertexShader、fragmentShader 的着色器参数对象
 * @param renderer - WebGL 渲染器实例
 */
export type ShaderCompileCallback = (
    shader: THREE.WebGLProgramParametersWithUniforms,
    renderer: THREE.WebGLRenderer
) => void;

/**
 * THREE.js 材质内部隐藏属性接口
 *
 * 描述 THREE.js 材质类中未在公共类型中暴露但在运行时存在的属性
 */
export interface HiddenThreeJSMaterialProperties {
    /**
     * 通知 THREE.js 重新编译材质着色器（由于代码或 defines 变更）
     */
    needsUpdate?: boolean;

    /**
     * 隐藏的 ThreeJS 值，在此公开以向 MeshBasicMaterial/MeshStandardMaterial 等子类添加新 uniforms
     * @deprecated 对此属性的更改将被忽略
     */
    uniformsNeedUpdate?: boolean;

    /**
     * 所有 ThreeJS 材质中可用
     */
    transparent?: boolean;

    /**
     * 材质着色器 defines（内部使用）
     */
    defines?: ShaderDefines;

    /**
     * THREE.js 材质中可用的 defines 回调
     * 在着色器程序编译前调用以生成顶点和片元着色器输出代码
     */
    onBeforeCompile?: ShaderCompileCallback;
}

/**
 * Mixin 着色器属性接口
 * 用于 mixin 类访问材质内部的着色器 defines 和 uniforms
 */
export interface MixinShaderProperties {
    /**
     * 材质着色器 defines（内部引用）
     */
    shaderDefines?: ShaderDefines;

    /**
     * 材质内部着色器 uniforms 引用
     *
     * 持有材质内部 shader uniforms 映射的引用。
     * 基于 mixin feature 的新 uniforms 通过此引用注入，内部 THREE.js shader uniforms
     * 也会在 feature 启用时通过 [[Material#onBeforeCompile]] 回调后通过此映射可用
     * @see needsUpdate
     */
    shaderUniforms?: ShaderUniforms;
}

/**
 * 具有位移贴图 UV 矩阵的材质接口
 */
export interface DisplacementMapProperties {
    /** 位移贴图 */
    displacementMap: THREE.Texture | null;
    /** 位移贴图 UV 变换矩阵 */
    displacementMapUvMatrix?: THREE.Matrix3;
}

/**
 * 颜色值联合类型
 * THREE.Color 接受的颜色表示形式：数字、字符串或 Color 对象
 */
export type ColorRepresentation = THREE.ColorRepresentation;

/**
 * 安全设置材质颜色
 *
 * @param color - 目标 THREE.Color 对象
 * @param value - 颜色值（数字、字符串或 Color）
 */
export function setMaterialColor(color: THREE.Color, value: ColorRepresentation): void {
    color.set(value);
}

/**
 * 将 mixin 与材质的内部 defines 和 uniforms 关联
 *
 * 在 THREE.Material 构造后立即调用（在派生类的 super 调用后）
 *
 * @param mixin - 将向材质添加功能的 mixin
 * @param material - 正在应用 mixin feature 的材质
 */
export function linkMixinWithMaterial(
    mixin: MixinShaderProperties,
    material: HiddenThreeJSMaterialProperties
): void {
    if (material.defines === undefined) {
        material.defines = {};
    }
    mixin.shaderDefines = material.defines;

    if (mixin.shaderUniforms === undefined) {
        mixin.shaderUniforms = {};
    }
}

/**
 * 将 mixin 的 shaderUniforms 与实际材质着色器 uniforms 关联
 *
 * 在 onBeforeCompile 回调中调用，将 mixin 特有的 uniforms 注入着色器
 *
 * @param mixin - 正在应用的 mixin feature
 * @param shader - 与材质关联的实际着色器参数
 */
export function linkMixinWithShader(
    mixin: MixinShaderProperties,
    shader: THREE.WebGLProgramParametersWithUniforms
): void {
    Object.assign(shader.uniforms, mixin.shaderUniforms);
    mixin.shaderUniforms = shader.uniforms;
}

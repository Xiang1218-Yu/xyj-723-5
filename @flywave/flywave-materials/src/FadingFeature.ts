/* Copyright (C) 2025 flywave.gl contributors */

import { assert, chainCallbacks } from "@flywave/flywave-utils";
import * as THREE from "three";

import {
    type HiddenThreeJSMaterialProperties,
    type MixinShaderProperties,
    type ShaderCompileCallback,
    type ShaderDefines,
    type ShaderUniforms,
    linkMixinWithMaterial,
    linkMixinWithShader
} from "./MaterialTypes";
import { ensureShaderChunks } from "./ShaderChunkManager";
import { disableBlending, enableBlending, insertShaderInclude, setShaderDefine } from "./Utils";
import { type ViewRanges } from "./ViewRanges";

/**
 * 构造实现 FadingFeature 的新实例时使用的参数
 */
export interface FadingFeatureParameters {
    /**
     * 到相机的距离（范围: `[0.0, 1.0]`），从此距离开始对象淡出
     */
    fadeNear?: number;

    /**
     * 到相机的距离（范围: `[0.0, 1.0]`），从此距离开始对象完全透明
     */
    fadeFar?: number;
}

/**
 * 所有应根据距离淡入淡出的对象的基础接口
 *
 * @remarks
 * FadingFeature 的实际实现借助 Mixin 类 {@link FadingFeatureMixin}
 * 和同名命名空间中的一组支持函数完成
 */
export interface FadingFeature extends HiddenThreeJSMaterialProperties, MixinShaderProperties {
    /**
     * 到相机的距离（范围: `[0.0, 1.0]`），从此距离开始对象淡出
     */
    fadeNear?: number;

    /**
     * 到相机的距离（范围: `[0.0, 1.0]`），从此距离开始对象完全透明。
     * 值 <= 0.0 时禁用淡入淡出
     */
    fadeFar?: number;
}

/**
 * 将线性距离值 [0..1]（其中 1 是到远平面的距离）转换为 [0..maxVisibilityRange]
 *
 * 从 MapViewUtils 复制，此处由于循环依赖无法直接访问
 *
 * @param distance - 到相机的距离（范围: [0, 1]）
 * @param visibilityRange - 描述最大和最小可见距离范围的对象
 * @returns 世界空间距离
 */
export function cameraToWorldDistance(distance: number, visibilityRange: ViewRanges): number {
    return distance * visibilityRange.maximum;
}

/**
 * FadingFeature 支持函数命名空间
 */
export namespace FadingFeature {
    export const DEFAULT_FADE_NEAR: number = -1.0;
    export const DEFAULT_FADE_FAR: number = -1.0;

    /**
     * 根据 feature 参数检查 feature 是否启用
     *
     * 如果 fadeFar 为 undefined 或 fadeFar <= 0.0，则淡入淡出 feature 将被禁用
     * @param fadingMaterial - FadingFeature 实例
     * @returns feature 是否已启用
     */
    export function isEnabled(fadingMaterial: FadingFeature): boolean {
        return (
            fadingMaterial.fadeNear !== undefined &&
            fadingMaterial.fadeFar !== undefined &&
            fadingMaterial.fadeFar > 0
        );
    }

    /**
     * 根据 feature 参数检查 feature 是否已定义
     * @param fadingMaterial - FadingFeature 实例
     * @returns fadeNear 和 fadeFar 是否已定义
     */
    export function isDefined(fadingMaterial: FadingFeature): boolean {
        return fadingMaterial.fadeNear !== undefined && fadingMaterial.fadeFar !== undefined;
    }

    /**
     * 更新 `FadingFeature` 的内部状态（根据 fadeNear 的值）。
     * 如果 fadeFar <= 0.0，淡入淡出 feature 将被禁用
     *
     * @param fadingMaterial - FadingFeature 实例
     */
    export function updateFadingFeature(fadingMaterial: FadingFeature): void {
        assert(fadingMaterial.shaderDefines !== undefined);
        assert(fadingMaterial.shaderUniforms !== undefined);

        const useFading = isEnabled(fadingMaterial);
        const needsUpdate = setShaderDefine(
            fadingMaterial.shaderDefines,
            "FADING_MATERIAL",
            useFading
        );
        fadingMaterial.needsUpdate = needsUpdate;

        assert(
            fadingMaterial.shaderUniforms!.fadeNear !== undefined &&
                fadingMaterial.shaderUniforms!.fadeFar !== undefined
        );

        if (useFading) {
            fadingMaterial.shaderUniforms!.fadeNear.value = fadingMaterial.fadeNear;
            fadingMaterial.shaderUniforms!.fadeFar.value = fadingMaterial.fadeFar;
            if (needsUpdate) {
                if (fadingMaterial instanceof THREE.Material) {
                    enableBlending(fadingMaterial as THREE.Material);
                }
            }
        } else if (needsUpdate) {
            fadingMaterial.shaderUniforms!.fadeNear.value = FadingFeature.DEFAULT_FADE_NEAR;
            fadingMaterial.shaderUniforms!.fadeFar.value = FadingFeature.DEFAULT_FADE_FAR;
            if (fadingMaterial instanceof THREE.Material) {
                disableBlending(fadingMaterial as THREE.Material);
            }
        }
    }

    /**
     * 在材质的 `onBeforeCompile` 回调中调用此函数。
     * 它会向着色器添加所需代码，并声明基于视距控制淡入淡出的新 uniforms
     *
     * @param fadingMaterial - 要添加 uniforms 的材质
     * @param shader - 包含顶点和片元着色器的 [[THREE.WebGLShader]]
     */
    export function onBeforeCompile(
        fadingMaterial: FadingFeature,
        shader: THREE.WebGLProgramParameters
    ): void {
        if (!isEnabled(fadingMaterial)) {
            return;
        }
        assert(fadingMaterial.shaderUniforms !== undefined);

        linkMixinWithShader(fadingMaterial, shader as THREE.WebGLProgramParametersWithUniforms);

        shader.vertexShader = insertShaderInclude(
            shader.vertexShader,
            "fog_pars_vertex",
            "fading_pars_vertex"
        );

        shader.vertexShader = insertShaderInclude(
            shader.vertexShader,
            "fog_vertex",
            "fading_vertex",
            true
        );

        shader.fragmentShader = insertShaderInclude(
            shader.fragmentShader,
            "fog_pars_fragment",
            "fading_pars_fragment"
        );

        shader.fragmentShader = insertShaderInclude(
            shader.fragmentShader,
            "fog_fragment",
            "fading_fragment",
            true
        );
    }

    /**
     * 由于 three.js 最后渲染透明对象（内部处理），无论 renderOrder 值如何，
     * 我们在 [[onAfterRenderCall]] 中将 transparent 值设为 false。
     * 在 [[onBeforeRender]] 中，函数 [[calculateDepthFromCameraDistance]] 根据淡入淡出距离值设置其为 true
     *
     * @param object - 准备渲染的 [[THREE.Object3D]]
     * @param viewRanges - 当前相机的可见范围（裁剪平面和最大可见距离）
     * @param fadeNear - 材质中要设置的 fadeNear 值
     * @param fadeFar - 材质中要设置的 fadeFar 值
     * @param updateUniforms - 如果为 `true`，则设置淡入淡出 uniforms
     * @param additionalCallback - 如果定义，在函数返回前调用此回调
     */
    export function addRenderHelper(
        object: THREE.Object3D,
        viewRanges: ViewRanges,
        fadeNear: number | undefined,
        fadeFar: number | undefined,
        updateUniforms: boolean,
        additionalCallback?: (
            renderer: THREE.WebGLRenderer,
            material: THREE.Material & FadingFeature
        ) => void
    ): void {
        object.onBeforeRender = chainCallbacks(
            object.onBeforeRender,
            (
                renderer: THREE.WebGLRenderer,
                scene: THREE.Scene,
                camera: THREE.Camera,
                geometry: THREE.BufferGeometry,
                material: THREE.Material & FadingFeature,
                group: THREE.Group
            ) => {
                const fadingMaterial = material as FadingFeature;

                fadingMaterial.fadeNear =
                    fadeNear === undefined || fadeNear === FadingFeature.DEFAULT_FADE_NEAR
                        ? FadingFeature.DEFAULT_FADE_NEAR
                        : cameraToWorldDistance(fadeNear, viewRanges);

                fadingMaterial.fadeFar =
                    fadeFar === undefined || fadeFar === FadingFeature.DEFAULT_FADE_FAR
                        ? FadingFeature.DEFAULT_FADE_FAR
                        : cameraToWorldDistance(fadeFar, viewRanges);

                if (additionalCallback !== undefined) {
                    additionalCallback(renderer, material);
                }
            }
        );
    }
}

/**
 * 用于扩展 THREE 材质的 Mixin 类。添加 `fadeNear` 和 `fadeFar` 所需的新属性
 *
 * @see [[Tile#addRenderHelper]]
 */
export class FadingFeatureMixin implements FadingFeature {
    needsUpdate?: boolean;
    uniformsNeedUpdate?: boolean;
    defines?: ShaderDefines;
    shaderDefines?: ShaderDefines;
    shaderUniforms?: ShaderUniforms;
    onBeforeCompile?: ShaderCompileCallback;
    private m_fadeNear: number = FadingFeature.DEFAULT_FADE_NEAR;
    private m_fadeFar: number = FadingFeature.DEFAULT_FADE_FAR;

    protected getFadeNear(): number {
        return this.m_fadeNear;
    }

    protected setFadeNear(value: number): void {
        const needsUpdate = value !== this.m_fadeNear;
        if (needsUpdate) {
            this.m_fadeNear = value;
            FadingFeature.updateFadingFeature(this);
        }
    }

    protected getFadeFar(): number {
        return this.m_fadeFar;
    }

    protected setFadeFar(value: number): void {
        const needsUpdate = value !== this.m_fadeFar;
        if (needsUpdate) {
            this.m_fadeFar = value;
            FadingFeature.updateFadingFeature(this);
        }
    }

    protected addFadingProperties(): void {
        Object.defineProperty(this, "fadeNear", {
            get: () => this.getFadeNear(),
            set: (val: number) => this.setFadeNear(val)
        });
        Object.defineProperty(this, "fadeFar", {
            get: () => this.getFadeFar(),
            set: (val: number) => this.setFadeFar(val)
        });
    }

    protected applyFadingParameters(params?: FadingFeatureParameters): void {
        linkMixinWithMaterial(this, this);

        assert(this.shaderDefines !== undefined);
        assert(this.shaderUniforms !== undefined);

        this.shaderUniforms!.fadeNear = new THREE.Uniform(FadingFeature.DEFAULT_FADE_NEAR);
        this.shaderUniforms!.fadeFar = new THREE.Uniform(FadingFeature.DEFAULT_FADE_FAR);

        if (params !== undefined) {
            if (params.fadeNear !== undefined) {
                this.setFadeNear(params.fadeNear);
            }
            if (params.fadeFar !== undefined) {
                this.setFadeFar(params.fadeFar);
            }
        }

        ensureShaderChunks("fading");

        this.onBeforeCompile = chainCallbacks(
            this.onBeforeCompile,
            (shader: THREE.WebGLProgramParameters) => {
                FadingFeature.onBeforeCompile(this, shader);
            }
        );
        this.needsUpdate = FadingFeature.isEnabled(this);
    }

    protected copyFadingParameters(source: FadingFeature): this {
        this.setFadeNear(
            source.fadeNear === undefined ? FadingFeature.DEFAULT_FADE_NEAR : source.fadeNear
        );
        this.setFadeFar(
            source.fadeFar === undefined ? FadingFeature.DEFAULT_FADE_FAR : source.fadeFar
        );
        return this;
    }
}

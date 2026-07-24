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
import { ExtrusionFeatureDefs } from "./MapMeshMaterialsDefs";
import { ensureShaderChunks } from "./ShaderChunkManager";
import { insertShaderInclude, setShaderDefine } from "./Utils";

/**
 * 构造实现 ExtrusionFeature 的新实例时使用的参数
 */
export interface ExtrusionFeatureParameters {
    /**
     * 挤出对象的比例，`1.0` 为默认值
     */
    extrusionRatio?: number;

    /**
     * 启用 z-fighting 解决方法，不对高度小于
     * [[ExtrusionFeatureDefs.MIN_BUILDING_HEIGHT]] 的建筑进行动画
     *
     * 应应用于使用此 feature 的 `polygon` 材质
     */
    zFightingWorkaround?: boolean;
}

/**
 * 所有应具有动画挤出效果的对象的基础接口
 *
 * @remarks
 * ExtrusionFeature 的实际实现借助 Mixin 类 {@link ExtrusionFeatureMixin}
 * 和同名命名空间中的一组支持函数完成
 */
export interface ExtrusionFeature extends HiddenThreeJSMaterialProperties, MixinShaderProperties {
    /**
     * 挤出对象的比例，`1.0` 为默认值，建议最小值为 `0.01`
     */
    extrusionRatio?: number;
}

/**
 * 类型守卫：判断给定材质是否支持挤出效果
 * @param material - 要检查的材质
 * @returns 给定材质是否支持挤出
 */
export function hasExtrusionFeature(material: unknown): material is ExtrusionFeature {
    return material !== null && typeof material === "object" && "extrusionRatio" in material;
}

/**
 * ExtrusionFeature 支持函数命名空间
 */
export namespace ExtrusionFeature {
    /**
     * 根据 {@link ExtrusionFeature} 属性检查 feature 是否启用
     *
     * @param extrusionMaterial - ExtrusionFeature 实例
     */
    export function isEnabled(extrusionMaterial: ExtrusionFeature): boolean {
        return (
            extrusionMaterial.extrusionRatio !== undefined &&
            extrusionMaterial.extrusionRatio >= ExtrusionFeatureDefs.DEFAULT_RATIO_MIN
        );
    }

    /**
     * 根据 [[extrusionRatio]] 的值更新 `ExtrusionFeature` 的内部状态
     *
     * @param extrusionMaterial - ExtrusionFeature 实例
     */
    export function updateExtrusionFeature(extrusionMaterial: ExtrusionFeature): void {
        assert(extrusionMaterial.shaderDefines !== undefined);
        assert(extrusionMaterial.shaderUniforms !== undefined);

        const useExtrusion = isEnabled(extrusionMaterial);
        const needsUpdate = setShaderDefine(
            extrusionMaterial.shaderDefines,
            "EXTRUSION_MATERIAL",
            useExtrusion
        );
        extrusionMaterial.needsUpdate = needsUpdate;

        if (useExtrusion) {
            extrusionMaterial.shaderUniforms!.extrusionRatio.value =
                extrusionMaterial.extrusionRatio;
        } else if (needsUpdate) {
            extrusionMaterial.shaderUniforms!.extrusionRatio.value =
                ExtrusionFeatureDefs.DEFAULT_RATIO_MAX;
        }
    }

    /**
     * 在材质的 `onBeforeCompile` 回调中调用此函数。
     * 它会向着色器添加所需代码，并声明控制挤出的新 uniforms
     *
     * @param extrusionMaterial - 要添加 uniforms 的材质
     * @param shader - 包含顶点和片元着色器的 [[THREE.WebGLShader]]
     */
    export function onBeforeCompile(
        extrusionMaterial: ExtrusionFeature,
        shader: THREE.WebGLProgramParameters
    ): void {
        if (!isEnabled(extrusionMaterial)) {
            return;
        }
        assert(extrusionMaterial.shaderUniforms !== undefined);

        linkMixinWithShader(
            extrusionMaterial,
            shader as THREE.WebGLProgramParametersWithUniforms
        );

        shader.vertexShader = insertShaderInclude(
            shader.vertexShader,
            "common",
            "extrusion_pars_vertex"
        );

        shader.vertexShader = insertShaderInclude(
            shader.vertexShader,
            "begin_vertex",
            "extrusion_vertex",
            true
        );

        shader.fragmentShader = insertShaderInclude(
            shader.fragmentShader,
            "fog_pars_fragment",
            "extrusion_pars_fragment"
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <normal_fragment_begin>",
            "#include <extrusion_normal_fragment_begin>"
        );

        shader.fragmentShader = insertShaderInclude(
            shader.fragmentShader,
            "fog_fragment",
            "extrusion_fragment",
            true
        );
    }
}

/**
 * 用于扩展 THREE 材质的 Mixin 类。添加 `extrusionRatio` 所需的新属性
 *
 * @remarks
 * extrusionRatio 属性有特殊处理，它通过
 * {@link @flywave/flywave-mapview#AnimatedExtrusionHandler} 进行动画，
 * 使用 [[extrusionRatio]] 的 setter 和 getter 更新挤出值，
 * 与 mixin 和 EdgeMaterial 良好配合
 */
export class ExtrusionFeatureMixin implements ExtrusionFeature {
    needsUpdate?: boolean;
    uniformsNeedUpdate?: boolean;
    defines?: ShaderDefines;
    shaderDefines?: ShaderDefines;
    shaderUniforms?: ShaderUniforms;
    onBeforeCompile?: ShaderCompileCallback;
    private m_extrusion: number = ExtrusionFeatureDefs.DEFAULT_RATIO_MAX;

    protected getExtrusionRatio(): number {
        return this.m_extrusion;
    }

    protected setExtrusionRatio(value: number): void {
        const needsUpdate = value !== this.m_extrusion;
        if (needsUpdate) {
            this.m_extrusion = value;
            ExtrusionFeature.updateExtrusionFeature(this);
        }
    }

    protected addExtrusionProperties(): void {
        Object.defineProperty(this, "extrusionRatio", {
            get: () => this.getExtrusionRatio(),
            set: (val: number) => this.setExtrusionRatio(val)
        });
    }

    protected applyExtrusionParameters(params?: ExtrusionFeatureParameters): void {
        linkMixinWithMaterial(this, this);

        assert(this.shaderDefines !== undefined);
        assert(this.shaderUniforms !== undefined);

        if (params && params.zFightingWorkaround === true) {
            this.shaderDefines.ZFIGHTING_WORKAROUND = "";
        }

        this.shaderUniforms!.extrusionRatio = new THREE.Uniform(
            ExtrusionFeatureDefs.DEFAULT_RATIO_MAX
        );

        if (params !== undefined) {
            if (params.extrusionRatio !== undefined) {
                this.setExtrusionRatio(params.extrusionRatio);
            }
        }

        ensureShaderChunks("extrusion");

        this.onBeforeCompile = chainCallbacks(
            this.onBeforeCompile,
            (shader: THREE.WebGLProgramParameters) => {
                ExtrusionFeature.onBeforeCompile(
                    this,
                    shader as THREE.WebGLProgramParametersWithUniforms
                );
            }
        );

        this.needsUpdate = ExtrusionFeature.isEnabled(this);
    }

    protected copyExtrusionParameters(source: ExtrusionFeature): this {
        if (source.extrusionRatio !== undefined) {
            this.setExtrusionRatio(source.extrusionRatio);
        }
        return this;
    }
}

/* Copyright (C) 2025 flywave.gl contributors */

import { assert, chainCallbacks } from "@flywave/flywave-utils";
import * as THREE from "three";

import { type TileDisplacementMap } from "./DisplacementMap";
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
import { setShaderDefine } from "./Utils";

const emptyTexture = new THREE.Texture();

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
export interface DisplacementFeature extends HiddenThreeJSMaterialProperties, MixinShaderProperties {
    /** 位移贴图 */
    displacementMap: THREE.Texture | null;
    /** 位移贴图 UV 变换矩阵 */
    displacementMapUvMatrix?: THREE.Matrix3;
}

/**
 * 类型守卫：判断给定材质是否支持用于高程叠加的位移贴图
 *
 * @param material - 要检查的材质
 * @returns 给定材质是否为 DisplacementFeature
 */
export function hasDisplacementFeature(material: unknown): material is DisplacementFeature {
    return material !== null && typeof material === "object" && "displacementMap" in material;
}

/**
 * DisplacementFeature 支持函数命名空间
 */
export namespace DisplacementFeature {
    /**
     * 检查 feature 是否已启用（位移贴图已定义）
     *
     * @param displacementMaterial - DisplacementFeature 实例
     */
    export function isEnabled(displacementMaterial: DisplacementFeature): boolean {
        return displacementMaterial.displacementMap !== null;
    }

    /**
     * 根据 [[displacementMap]] 的值更新 `DisplacementFeature` 的内部状态
     *
     * @param displacementMaterial - DisplacementFeature 实例
     */
    export function updateDisplacementFeature(
        displacementMaterial: DisplacementFeature & MixinShaderProperties
    ): void {
        assert(displacementMaterial.shaderDefines !== undefined);
        assert(displacementMaterial.shaderUniforms !== undefined);

        const useDisplacementMap = isEnabled(displacementMaterial);
        const needsUpdate = setShaderDefine(
            displacementMaterial.shaderDefines,
            "USE_DISPLACEMENTMAP",
            useDisplacementMap
        );
        displacementMaterial.needsUpdate = needsUpdate;

        if (useDisplacementMap) {
            const texture = displacementMaterial.displacementMap!;
            texture.needsUpdate = true;
            displacementMaterial.shaderUniforms!.displacementMap.value = texture;
        } else if (needsUpdate) {
            displacementMaterial.shaderUniforms!.displacementMap.value = emptyTexture;
        }
    }

    /**
     * 在材质的 `onBeforeCompile` 回调中调用此函数。
     * 它会向着色器添加应用位移贴图所需的代码
     *
     * @param displacementMaterial - 要添加 uniforms 的材质
     * @param shader - 包含顶点和片元着色器的 [[THREE.WebGLShader]]
     */
    export function onBeforeCompile(
        displacementMaterial: DisplacementFeature & MixinShaderProperties,
        shader: THREE.WebGLProgramParameters
    ): void {
        if (!isEnabled(displacementMaterial)) {
            return;
        }
        assert(displacementMaterial.shaderUniforms !== undefined);

        linkMixinWithShader(
            displacementMaterial,
            shader as THREE.WebGLProgramParametersWithUniforms
        );

        shader.vertexShader = shader.vertexShader.replace(
            "#include <common>",
            `#include <common>
            #ifdef USE_DISPLACEMENTMAP
                uniform mat3 displacementUvTransform;
                uniform sampler2D displacementMap;
                uniform float displacementScale;
                uniform float displacementBias;
            #endif`
        );

        shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
            #ifdef USE_DISPLACEMENTMAP
                transformed += normalize( objectNormal ) * ( texture2D( displacementMap, ( displacementUvTransform * vec3( uv, 1 ) ).xy ).x * displacementScale + displacementBias );
            #endif`
        );
    }
}

/**
 * 位移贴图 Mixin 类
 */
export class DisplacementFeatureMixin implements DisplacementFeature, MixinShaderProperties {
    needsUpdate?: boolean;
    uniformsNeedUpdate?: boolean;
    defines?: ShaderDefines;
    shaderDefines?: ShaderDefines;
    shaderUniforms?: ShaderUniforms;
    onBeforeCompile?: ShaderCompileCallback;
    displacementMapUvMatrix?: THREE.Matrix3;
    private m_displacementMap: THREE.Texture | null = null;

    get displacementMap(): THREE.Texture | null {
        return this.m_displacementMap;
    }

    set displacementMap(map: THREE.Texture | null) {
        this.setDisplacementMap(map);
    }

    protected getDisplacementMap(): THREE.Texture | null {
        return this.m_displacementMap;
    }

    protected setDisplacementMap(map: THREE.Texture | null): void {
        if (map !== this.m_displacementMap) {
            this.m_displacementMap = map;
            DisplacementFeature.updateDisplacementFeature(this);
        }
    }

    /**
     * Mixin 类应调用此方法来注册 [[displacementMap]] 属性
     */
    protected addDisplacementProperties(): void {
        Object.defineProperty(this, "displacementMap", {
            get: () => this.getDisplacementMap(),
            set: (val: THREE.Texture | null) => this.setDisplacementMap(val)
        });
    }

    /**
     * 将参数中的 displacementMap 值应用到相应属性
     */
    protected applyDisplacementParameters(params?: DisplacementFeatureParameters): void {
        linkMixinWithMaterial(this, this);

        assert(this.shaderDefines !== undefined);
        assert(this.shaderUniforms !== undefined);

        const uniforms = this.shaderUniforms!;
        uniforms.displacementMap = new THREE.Uniform(emptyTexture);
        uniforms.displacementScale = new THREE.Uniform(1);
        uniforms.displacementBias = new THREE.Uniform(0);
        uniforms.displacementUvTransform = new THREE.Uniform(new THREE.Matrix3());

        if (params !== undefined) {
            if (params.displacementMap !== undefined) {
                this.setDisplacementMap(params.displacementMap);
            }
        }

        this.onBeforeCompile = chainCallbacks(
            this.onBeforeCompile,
            (shader: THREE.WebGLProgramParameters) => {
                DisplacementFeature.onBeforeCompile(
                    this,
                    shader as THREE.WebGLProgramParametersWithUniforms
                );
            }
        );

        this.needsUpdate = DisplacementFeature.isEnabled(this);
    }

    /**
     * 从另一个 DisplacementFeature 复制 displacementMap
     *
     * @param source - 要复制属性值的材质
     */
    protected copyDisplacementParameters(source: DisplacementFeature): this {
        this.setDisplacementMap(source.displacementMap);
        return this;
    }
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
        for (const mat of material) {
            if (hasDisplacementFeature(mat)) {
                setDisplacementMapToSingleMaterial(displacementMap, mat);
            }
        }
    } else if (hasDisplacementFeature(material)) {
        setDisplacementMapToSingleMaterial(displacementMap, material);
    }
}

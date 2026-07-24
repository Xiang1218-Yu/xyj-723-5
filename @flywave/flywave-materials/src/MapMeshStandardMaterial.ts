/* Copyright (C) 2025 flywave.gl contributors */

import { chainCallbacks } from "@flywave/flywave-utils";
import * as THREE from "three";

import { type ExtrusionFeatureParameters, ExtrusionFeature } from "./ExtrusionFeature";
import { type FadingFeatureParameters, FadingFeature } from "./FadingFeature";
import { simpleLightingShadowChunk } from "./ShaderChunks/ShadowChunks";

/**
 * 控制修补标准材质着色器以确保材质颜色不受光照方向影响的参数。
 * 仅对 "fill" 类型的 technique 有效
 */
export interface ShadowFeatureParameters {
    /**
     * 是否移除漫反射光分量（即材质颜色仅为环境光 + 阴影）
     */
    removeDiffuseLight?: boolean;
}

/**
 * [[THREE.MeshStandardMaterial]] 的子类。
 * 添加了 `fadeNear` 和 `fadeFar` 所需的新属性。
 * 除了填充相应 uniforms 的新属性外，还需要在对象的
 * `onBeforeRender` 和 `onAfterRender` 调用中更新材质，
 * 设置 `transparent` 标志并更新世界空间距离值。
 *
 * @see [[Tile#addRenderHelper]]
 */
export class MapMeshStandardMaterial
    extends THREE.MeshStandardMaterial
    implements FadingFeature, ExtrusionFeature
{
    uniformsNeedUpdate?: boolean;

    constructor(
        params?: THREE.MeshStandardMaterialParameters &
            FadingFeatureParameters &
            ExtrusionFeatureParameters &
            ShadowFeatureParameters
    ) {
        super(params);

        this.addFadingProperties();
        this.applyFadingParameters(params);

        this.addExtrusionProperties();
        this.applyExtrusionParameters({ ...params, zFightingWorkaround: true });

        this.onBeforeCompile = chainCallbacks(this.onBeforeCompile, shaderParameters => {
            const shader = shaderParameters as THREE.WebGLProgramParametersWithUniforms;
            if (params?.removeDiffuseLight === true) {
                shader.fragmentShader = shader.fragmentShader.replace(
                    "#include <lights_physical_pars_fragment>",
                    simpleLightingShadowChunk
                );
            }
        });
    }

    clone(): this {
        return new MapMeshStandardMaterial().copy(this) as this;
    }

    copy(source: this): this {
        super.copy(source);
        this.copyFadingParameters(source);
        this.copyExtrusionParameters(source);
        return this;
    }

    // Mixin implementations - overwritten by applyMixinsWithoutProperties
    get fadeNear(): number { return FadingFeature.DEFAULT_FADE_NEAR; }
    set fadeNear(value: number) {}
    get fadeFar(): number { return FadingFeature.DEFAULT_FADE_FAR; }
    set fadeFar(value: number) {}
    get extrusionRatio(): number { return 1.0; }
    set extrusionRatio(value: number) {}
    get displacementMap(): THREE.Texture | null { return null; }
    set displacementMap(value: THREE.Texture | null) {}

    get removeDiffuseLight(): boolean { return false; }
    set removeDiffuseLight(val: boolean) {}

    protected addFadingProperties(): void {}
    protected applyFadingParameters(params?: FadingFeatureParameters): void {}
    protected copyFadingParameters(source: FadingFeature): this { return this; }
    protected addExtrusionProperties(): void {}
    protected applyExtrusionParameters(params?: ExtrusionFeatureParameters): void {}
    protected copyExtrusionParameters(source: ExtrusionFeature): this { return this; }
}

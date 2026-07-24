/* Copyright (C) 2025 flywave.gl contributors */

import { assert, chainCallbacks } from "@flywave/flywave-utils";
import * as THREE from "three";

import {
    type CompileCallback,
    type HiddenThreeJSMaterialProperties,
    type MixinShaderProperties,
    type UniformsType,
    linkMixinWithMaterial,
    linkMixinWithShader
} from "./MaterialFeatureTypes";
import fadingShaderChunk from "./ShaderChunks/FadingChunks";
import { ShaderChunkRegistry } from "./ShaderChunks/ShaderChunkRegistry";
import { disableBlending, enableBlending, insertShaderInclude, setShaderDefine, type ShaderDefines } from "./Utils";
import { type ViewRanges } from "./ViewRanges";

/**
 * Fading feature.
 *
 * @remarks
 * The MapMeshMaterials {@link MapMeshBasicMaterial} and {@link MapMeshStandardMaterial} fade out the
 * geometry between a fadeNear and fadeFar value. This module owns everything related to that single
 * responsibility: its parameters, feature interface, supporting namespace functions and the mixin
 * class used to graft the feature onto existing THREE material classes.
 */

/**
 * Parameters used when constructing a new implementor of {@link FadingFeature}.
 */
export interface FadingFeatureParameters {
    /**
     * Distance to the camera (range: `[0.0, 1.0]`) from which the objects start fading out.
     */
    fadeNear?: number;

    /**
     * Distance to the camera (range: `[0.0, 1.0]`) from which the objects are transparent.
     */
    fadeFar?: number;
}

/**
 * Base interface for all objects that should fade in the distance. The implementation of the actual
 * FadingFeature is done with the help of the mixin class {@link FadingFeatureMixin} and a set of
 * supporting functions in the namespace of the same name.
 */
export interface FadingFeature extends HiddenThreeJSMaterialProperties, MixinShaderProperties {
    /**
     * Distance to the camera (range: `[0.0, 1.0]`) from which the objects start fading out.
     */
    fadeNear?: number;

    /**
     * Distance to the camera (range: `[0.0, 1.0]`) from which the objects are transparent. A value
     * of <= 0.0 disables fading.
     */
    fadeFar?: number;
}

/**
 * Translates a linear distance value [0..1], where 1 is the distance to the far plane, into
 * [0..maxVisibilityRange].
 *
 * Copy from MapViewUtils, since it cannot be accessed here because of circular dependencies.
 *
 * @param distance - Distance from the camera (range: [0, 1]).
 * @param visibilityRange - object describing maximum and minimum visibility range - distances
 * from camera at which objects won't be rendered anymore.
 */
function cameraToWorldDistance(distance: number, visibilityRange: ViewRanges): number {
    return distance * visibilityRange.maximum;
}

/**
 * Namespace with support functions for implementors of `FadingFeature`.
 */
export namespace FadingFeature {
    export const DEFAULT_FADE_NEAR: number = -1.0;
    export const DEFAULT_FADE_FAR: number = -1.0;

    /**
     * Unique key used to register the fading shader chunks with the {@link ShaderChunkRegistry}.
     */
    const SHADER_CHUNK_KEY = "fading";

    /**
     * Checks if feature is enabled based on feature params.
     *
     * Fading feature will be disabled if fadeFar is undefined or fadeFar <= 0.0.
     * This function is crucial for shader switching (chunks injection), whenever feature state
     * changes between enabled/disabled. Current approach is to keep feature on (once enabled)
     * whenever fading params are reasonable, even if it causes full fade in, no transparency.
     *
     * @param fadingMaterial - FadingFeature.
     */
    export function isEnabled(fadingMaterial: FadingFeature) {
        return (
            fadingMaterial.fadeNear !== undefined &&
            fadingMaterial.fadeFar !== undefined &&
            fadingMaterial.fadeFar > 0
        );
    }

    /**
     * Checks if feature is defined based on feature params.
     *
     * Fading feature will be defined if fadeNear and fadeFar are defined, their values
     * are not checked for reasonable values.
     *
     * @param fadingMaterial FadingFeature.
     */
    export function isDefined(fadingMaterial: FadingFeature) {
        return fadingMaterial.fadeNear !== undefined && fadingMaterial.fadeFar !== undefined;
    }

    /**
     * Patch the THREE.ShaderChunk on first call with some extra shader chunks.
     *
     * Delegates to the {@link ShaderChunkRegistry} so registration happens exactly once, regardless
     * of how many materials request it.
     */
    export function patchGlobalShaderChunks() {
        ShaderChunkRegistry.register(SHADER_CHUNK_KEY, fadingShaderChunk);
    }

    /**
     * Update the internals of the `FadingFeature` depending on the value of [[fadeNear]]. The
     * fading feature will be disabled if fadeFar <= 0.0.
     *
     * @param fadingMaterial - FadingFeature
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
                if (fadingMaterial instanceof THREE.Material)
                    enableBlending(fadingMaterial as THREE.Material);
            }
        } else if (needsUpdate) {
            fadingMaterial.shaderUniforms!.fadeNear.value = FadingFeature.DEFAULT_FADE_NEAR;
            fadingMaterial.shaderUniforms!.fadeFar.value = FadingFeature.DEFAULT_FADE_FAR;
            if (fadingMaterial instanceof THREE.Material)
                disableBlending(fadingMaterial as THREE.Material);
        }
    }

    /**
     * This function should be called on implementors of FadingFeature in the `onBeforeCompile`
     * callback of that material. It adds the required code to the shaders and declares the new
     * uniforms that control fading based on view distance.
     *
     * @param fadingMaterial - Material to add uniforms to.
     * @param shader - [[THREE.WebGLShader]] containing the vertex and fragment shaders to add the
     *                  special includes to.
     */
    export function onBeforeCompile(
        fadingMaterial: FadingFeature,
        shader: THREE.WebGLProgramParameters
    ) {
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
     * As three.js is rendering the transparent objects last (internally), regardless of their
     * renderOrder value, we set the transparent value to false in the [[onAfterRenderCall]]. In
     * [[onBeforeRender]], the function [[calculateDepthFromCameraDistance]] sets it to true if the
     * fade distance value is less than 1.
     *
     * @param object - [[THREE.Object3D]] to prepare for rendering.
     * @param viewRanges - The visibility ranges (clip planes and maximum visible distance) for
     * actual camera setup.
     * @param fadeNear - The fadeNear value to set in the material.
     * @param fadeFar - The fadeFar value to set in the material.
     * @param updateUniforms - If `true`, the fading uniforms are set. Not required if material is
     *          handling the uniforms already, like in a [[THREE.ShaderMaterial]].
     * @param additionalCallback - If defined, this function will be called before the function will
     *          return.
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
    ) {
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
 * Mixin class for extended THREE materials. Adds new properties required for `fadeNear` and
 * `fadeFar`. There is some special handling for the fadeNear/fadeFar properties, which get some
 * setters and getters in a way that works well with the mixin.
 *
 * @see [[Tile#addRenderHelper]]
 */
export class FadingFeatureMixin implements FadingFeature {
    needsUpdate?: boolean;
    uniformsNeedUpdate?: boolean;
    defines?: ShaderDefines;
    shaderDefines?: ShaderDefines;
    shaderUniforms?: UniformsType;
    onBeforeCompile?: CompileCallback;
    private m_fadeNear: number = FadingFeature.DEFAULT_FADE_NEAR;
    private m_fadeFar: number = FadingFeature.DEFAULT_FADE_FAR;

    protected getFadeNear(): number {
        return this.m_fadeNear;
    }

    protected setFadeNear(value: number) {
        const needsUpdate = value !== this.m_fadeNear;
        if (needsUpdate) {
            this.m_fadeNear = value;
            FadingFeature.updateFadingFeature(this);
        }
    }

    protected getFadeFar(): number {
        return this.m_fadeFar;
    }

    protected setFadeFar(value: number) {
        const needsUpdate = value !== this.m_fadeFar;
        if (needsUpdate) {
            this.m_fadeFar = value;
            FadingFeature.updateFadingFeature(this);
        }
    }

    protected addFadingProperties(): void {
        Object.defineProperty(this, "fadeNear", {
            get: () => {
                return this.getFadeNear();
            },
            set: val => {
                this.setFadeNear(val);
            }
        });
        Object.defineProperty(this, "fadeFar", {
            get: () => {
                return this.getFadeFar();
            },
            set: val => {
                this.setFadeFar(val);
            }
        });
    }

    protected applyFadingParameters(params?: FadingFeatureParameters) {
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

        this.onBeforeCompile = chainCallbacks(
            this.onBeforeCompile,
            (shader: THREE.WebGLProgramParameters) => {
                FadingFeature.onBeforeCompile(this, shader);
            }
        );
        this.needsUpdate = FadingFeature.isEnabled(this);
    }

    protected copyFadingParameters(source: FadingFeature) {
        this.setFadeNear(
            source.fadeNear === undefined ? FadingFeature.DEFAULT_FADE_NEAR : source.fadeNear
        );
        this.setFadeFar(
            source.fadeFar === undefined ? FadingFeature.DEFAULT_FADE_FAR : source.fadeFar
        );
        return this;
    }
}

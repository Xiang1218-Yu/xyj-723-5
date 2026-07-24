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
import { ExtrusionFeatureDefs } from "./MapMeshMaterialsDefs";
import extrusionShaderChunk from "./ShaderChunks/ExtrusionChunks";
import { ShaderChunkRegistry } from "./ShaderChunks/ShaderChunkRegistry";
import { insertShaderInclude, setShaderDefine, type ShaderDefines } from "./Utils";

/**
 * Extrusion feature.
 *
 * @remarks
 * Adds an animated extrusion effect to materials. This module owns the extrusion feature
 * exclusively: its parameters, feature interface, supporting namespace functions and the mixin
 * class used to graft the feature onto existing THREE material classes.
 */

/**
 * Parameters used when constructing a new implementor of {@link ExtrusionFeature}.
 */
export interface ExtrusionFeatureParameters {
    /**
     * Ratio of the extruded objects, where `1.0` is the default value
     */
    extrusionRatio?: number;

    /**
     * Enable z-fighting workaround that doesn't animate buildings with `height <
     * [[ExtrusionFeatureDefs.MIN_BUILDING_HEIGHT]]`.
     *
     * Should be applied to `polygon` materials using this feature.
     */
    zFightingWorkaround?: boolean;
}

/**
 * Base interface for all objects that should have animated extrusion effect.
 *
 * @remarks
 * The implementation of the actual ExtrusionFeature is done with
 * the help of the mixin class {@link ExtrusionFeatureMixin}
 * and a set of supporting functions in the namespace of the same name.
 */
export interface ExtrusionFeature extends HiddenThreeJSMaterialProperties, MixinShaderProperties {
    /**
     * Ratio of the extruded objects, where `1.0` is the default value. Minimum suggested value
     * is `0.01`
     */
    extrusionRatio?: number;
}

/**
 * Determines whether a given material supports extrusion.
 * @param material The material to check.
 * @returns Whether the given material supports extrusion.
 */
export function hasExtrusionFeature(material: THREE.Material): material is THREE.Material &
    ExtrusionFeature {
    return "extrusionRatio" in material;
}

export namespace ExtrusionFeature {
    /**
     * Unique key used to register the extrusion shader chunks with the {@link ShaderChunkRegistry}.
     */
    const SHADER_CHUNK_KEY = "extrusion";

    /**
     * Checks if feature is enabled based on {@link ExtrusionFeature} properties.
     *
     * @param extrusionMaterial -
     */
    export function isEnabled(extrusionMaterial: ExtrusionFeature) {
        return (
            extrusionMaterial.extrusionRatio !== undefined &&
            extrusionMaterial.extrusionRatio >= ExtrusionFeatureDefs.DEFAULT_RATIO_MIN
        );
    }

    /**
     * Patch the THREE.ShaderChunk on first call with some extra shader chunks.
     *
     * Delegates to the {@link ShaderChunkRegistry} so registration happens exactly once, regardless
     * of how many materials request it.
     */
    export function patchGlobalShaderChunks() {
        ShaderChunkRegistry.register(SHADER_CHUNK_KEY, extrusionShaderChunk);
    }

    /**
     * Update the internals of the `ExtrusionFeature` depending on the value of [[extrusionRatio]].
     *
     * @param ExtrusionMaterial - ExtrusionFeature
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
     * This function should be called on implementors of ExtrusionFeature in the `onBeforeCompile`
     * callback of that material. It adds the required code to the shaders and declares the new
     * uniforms that control extrusion.
     *
     * @param extrusionMaterial - Material to add uniforms to.
     * @param shader - [[THREE.WebGLShader]] containing the vertex and fragment shaders to add the
     *                  special includes to.
     */
    export function onBeforeCompile(
        extrusionMaterial: ExtrusionFeature,
        shader: THREE.WebGLProgramParameters
    ) {
        if (!isEnabled(extrusionMaterial)) {
            return;
        }
        assert(extrusionMaterial.shaderUniforms !== undefined);

        linkMixinWithShader(extrusionMaterial, shader as THREE.WebGLProgramParametersWithUniforms);

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
 * Mixin class for extended THREE materials. Adds new properties required for `extrusionRatio`.
 *
 * @remarks
 * There is some special handling for the extrusionRatio property, which is animated via
 * {@link @flywave/flywave-mapview#AnimatedExtrusionHandler} that is
 * using [[extrusionRatio]] setter and getter to update
 * extrusion in a way that works well with the mixin and EdgeMaterial.
 */
export class ExtrusionFeatureMixin implements ExtrusionFeature {
    needsUpdate?: boolean;
    uniformsNeedUpdate?: boolean;
    defines?: ShaderDefines;
    shaderDefines?: ShaderDefines;
    shaderUniforms?: UniformsType;
    onBeforeCompile?: CompileCallback;
    private m_extrusion: number = ExtrusionFeatureDefs.DEFAULT_RATIO_MAX;

    protected getExtrusionRatio(): number {
        return this.m_extrusion;
    }

    protected setExtrusionRatio(value: number) {
        const needsUpdate = value !== this.m_extrusion;
        if (needsUpdate) {
            this.m_extrusion = value;
            ExtrusionFeature.updateExtrusionFeature(this);
        }
    }

    protected addExtrusionProperties(): void {
        Object.defineProperty(this, "extrusionRatio", {
            get: () => {
                return this.getExtrusionRatio();
            },
            set: val => {
                this.setExtrusionRatio(val);
            }
        });
    }

    protected applyExtrusionParameters(params?: ExtrusionFeatureParameters) {
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

    protected copyExtrusionParameters(source: ExtrusionFeature) {
        if (source.extrusionRatio !== undefined) {
            this.setExtrusionRatio(source.extrusionRatio);
        }
        return this;
    }
}

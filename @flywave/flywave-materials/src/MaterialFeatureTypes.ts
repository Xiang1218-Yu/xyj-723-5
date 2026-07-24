/* Copyright (C) 2025 flywave.gl contributors */

import * as THREE from "three";

import { type ShaderDefines } from "./Utils";

/**
 * Shared material-feature primitives.
 *
 * @remarks
 * This module isolates the low-level types and linking helpers that the individual material
 * features (fading, extrusion, displacement) all depend on. Previously these lived inside
 * `MapMeshMaterials.ts`, which conflated concrete material classes with the generic feature
 * infrastructure. Extracting them here keeps each module focused on a single responsibility and
 * removes the circular dependency between the feature files and `MapMeshMaterials`.
 */

/**
 * Reusable empty texture used as a placeholder for optional sampler uniforms (e.g. displacement
 * maps) so the shader always has a valid, bindable texture even when the feature is disabled.
 */
export const emptyTexture = new THREE.Texture();

/**
 * Used internally.
 *
 * @hidden
 */
export type UniformsType = Record<string, THREE.IUniform>;

/**
 * Type of callback used internally by THREE.js for shader creation.
 *
 * @hidden
 */
export type CompileCallback = (
    shader: THREE.WebGLProgramParametersWithUniforms,
    renderer: THREE.WebGLRenderer
) => void;

/**
 * Material properties used from THREE, which may not be defined in the type.
 */
export interface HiddenThreeJSMaterialProperties {
    /**
     * Informs THREE.js to re-compile material shader (due to change in code or defines).
     */
    needsUpdate?: boolean;

    /**
     * Hidden ThreeJS value that is made public here. Required to add new uniforms to subclasses of
     * [[THREE.MeshBasicMaterial]]/[[THREE.MeshStandardMaterial]], basically all materials that are
     * not THREE.ShaderMaterial.
     * @deprecated Changes to this property are ignored.
     */
    uniformsNeedUpdate?: boolean;

    /**
     * Available in all materials in ThreeJS.
     */
    transparent?: boolean;

    /**
     * Used internally for material shader defines.
     */
    defines?: ShaderDefines;

    /**
     * Defines callback available in THREE.js materials.
     *
     * Called before shader program compilation to generate vertex & fragment shader output code.
     */
    onBeforeCompile?: CompileCallback;
}

/**
 * Used internally.
 *
 * @hidden
 */
export interface MixinShaderProperties {
    /**
     * Used internally for material shader defines.
     */
    shaderDefines?: ShaderDefines;

    /**
     * Used internally for shader uniforms, holds references to material internal shader.uniforms.
     *
     * Holds a reference to material's internal shader uniforms map. New custom feature based
     * uniforms are injected using this reference, but also internal THREE.js shader uniforms
     * will be available via this map after [[Material#onBeforeCompile]] callback is run with
     * feature enabled.
     * @see needsUpdate
     */
    shaderUniforms?: UniformsType;
}

/**
 * Provides common interface from mixin to internal material defines and shader uniforms.
 *
 * Call this function just after [THREE.Material] is constructed, so in derived classes after
 * super c-tor call.
 * @param mixin - The mixin that will add features to [[THREE.Material]].
 * @param material - The material that mixin feature is being applied.
 */
export function linkMixinWithMaterial(
    mixin: MixinShaderProperties,
    material: HiddenThreeJSMaterialProperties
) {
    // Some materials (MeshBasicMaterial) have no defines property created in c-tor.
    // In such case create it manually, such defines will be also injected to the shader
    // via generic THREE.js code - see THREE/WebGLProgram.js.
    if (material.defines === undefined) {
        material.defines = {};
    }
    // Link internal THREE.js material defines with mixin reference.
    // Those defines are usually created in Material c-tor, if not we have fallback above.
    mixin.shaderDefines = material.defines;

    // Prepare map for holding uniforms references from the actual shader, but check if
    // it was not already created with other mixin feature.
    if (mixin.shaderUniforms === undefined) {
        mixin.shaderUniforms = {};
    }
    // Shader uniforms may not be linked at this stage, they are injected available via Shader
    // object in onBeforeCompile callback, see: linkMixinWithShader().
}

/**
 * Links mixin [[MixinShaderProperties.shaderUniforms]] with actual material shader uniforms.
 *
 * Function injects features (mixin) specific shader uniforms to material's shader, it also
 * updates uniforms references so [[MixinShaderProperties.shaderUniforms]] will contain full
 * uniforms map (both feature specific and internal ones).
 * This function should be called before material's shader is pre-compiled, so the new uniforms
 * from the mixin feature are known to shader processor. The best place to use is
 * [[Material.onBeforeCompile]].
 * @param mixin - The mixin feature being applied to the material.
 * @param shader - The actual shader linked to the [[THREE.Material]].
 */
export function linkMixinWithShader(
    mixin: MixinShaderProperties,
    shader: THREE.WebGLProgramParametersWithUniforms
) {
    Object.assign(shader.uniforms, mixin.shaderUniforms);
    mixin.shaderUniforms = shader.uniforms;
}

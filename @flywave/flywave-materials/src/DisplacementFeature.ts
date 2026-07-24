/* Copyright (C) 2025 flywave.gl contributors */

import { assert, chainCallbacks } from "@flywave/flywave-utils";
import * as THREE from "three";

import { type TileDisplacementMap } from "./DisplacementMap";
import {
    type CompileCallback,
    type HiddenThreeJSMaterialProperties,
    type MixinShaderProperties,
    type UniformsType,
    emptyTexture,
    linkMixinWithMaterial,
    linkMixinWithShader
} from "./MaterialFeatureTypes";
import { setShaderDefine, type ShaderDefines } from "./Utils";
/**
 * Parameters used when constructing a new implementor of {@link DisplacementFeature}.
 */
export interface DisplacementFeatureParameters {
    /**
     * Texture used for vertex displacement along their normals.
     */
    displacementMap?: THREE.Texture;
    displacementMapUvMatrix?: THREE.Matrix3;
}

/**
 * Interface to be implemented by materials that use displacement maps to overlay geometry
 * on elevation data.
 */
export interface DisplacementFeature extends HiddenThreeJSMaterialProperties {
    displacementMap: THREE.Texture | null;

    /**
     * UV transform matrix applied to the displacement map. Optional because not every implementor
     * of the feature needs a custom UV transform.
     */
    displacementMapUvMatrix?: THREE.Matrix3;
}

/**
 * Determines whether a given material supports displacement maps for elevation overlay.
 * @param material - The material to check.
 * @returns Whether the given material supports displacement maps for elevation overlay.
 */
export function hasDisplacementFeature(
    material: THREE.Material | THREE.Material[]
): material is THREE.Material & DisplacementFeature {
    return !Array.isArray(material) && "displacementMap" in material;
}

/**
 * Sets the displacement map to the given material.
 * @param displacementMap - Texture representing the elevation data used to overlay the object.
 * @param material - The Material to be updated.
 */
export function setDisplacementMapToMaterial(
    displacementMap: TileDisplacementMap | null,
    material: THREE.Mesh["material"]
) {
    if (hasDisplacementFeature(material) && material.displacementMap !== displacementMap?.texture) {
        material.displacementMap = displacementMap?.texture as THREE.Texture;
        material.displacementMapUvMatrix = displacementMap?.uvMatrix;
        material.needsUpdate = true;
        if (material.displacementMap !== null) {
            material.displacementMap.needsUpdate = true;
        }
    }
}

/**
 * Namespace with support functions for implementors of `DisplacementFeature`.
 *
 * @remarks
 * Moved here from `MapMeshMaterials.ts` so the displacement feature (interface, helpers and mixin)
 * lives in a single module, following the single-responsibility principle.
 */
// See https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/no-redeclare.md#ignoredeclarationmerge
// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace DisplacementFeature {
    /**
     * Checks if feature is enabled (displacement map defined).
     *
     * @param displacementMaterial -
     */
    export function isEnabled(displacementMaterial: DisplacementFeature) {
        return displacementMaterial.displacementMap !== null;
    }

    /**
     * Update the internals of the `DisplacementFeature` depending on the value of
     * [[displacementMap]].
     *
     * @param displacementMaterial - DisplacementFeature
     */
    export function updateDisplacementFeature(
        displacementMaterial: DisplacementFeature & MixinShaderProperties
    ): void {
        assert(displacementMaterial.shaderDefines !== undefined);
        assert(displacementMaterial.shaderUniforms !== undefined);

        const useDisplacementMap = isEnabled(displacementMaterial);
        // Whenever displacement feature state changes (between enabled/disabled) material will be
        // re-compiled, forcing new shader chunks to be added (or removed).
        const needsUpdate = setShaderDefine(
            displacementMaterial.shaderDefines,
            "USE_DISPLACEMENTMAP",
            useDisplacementMap
        );
        displacementMaterial.needsUpdate = needsUpdate;

        // Update texture after change.
        if (useDisplacementMap) {
            const texture = displacementMaterial.displacementMap!;
            texture.needsUpdate = true;
            displacementMaterial.shaderUniforms!.displacementMap.value = texture;
        } else if (needsUpdate) {
            displacementMaterial.shaderUniforms!.displacementMap.value = emptyTexture;
        }
    }

    /**
     * This function should be called on implementors of DisplacementFeature in the
     * `onBeforeCompile` callback of that material. It adds the required code to the shaders to
     * apply displacement maps.
     *
     * @param displacementMaterial - Material to add uniforms to.
     * @param shader - [[THREE.WebGLShader]] containing the vertex and fragment shaders to add the
     *                  special includes to.
     */
    export function onBeforeCompile(
        displacementMaterial: DisplacementFeature & MixinShaderProperties,
        shader: THREE.WebGLProgramParameters
    ) {
        if (!isEnabled(displacementMaterial)) {
            return;
        }
        assert(displacementMaterial.shaderUniforms !== undefined);

        linkMixinWithShader(
            displacementMaterial,
            shader as THREE.WebGLProgramParametersWithUniforms
        );

        // Update displacement map handling for r174
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
 * Mixin class for extended THREE materials that implements {@link DisplacementFeature}.
 */
export class DisplacementFeatureMixin implements DisplacementFeature, MixinShaderProperties {
    needsUpdate?: boolean;
    uniformsNeedUpdate?: boolean;
    defines?: ShaderDefines;
    shaderDefines?: ShaderDefines;
    shaderUniforms?: UniformsType;
    onBeforeCompile?: CompileCallback;
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
     * The mixin class should call this method to register the property [[displacementMap]]
     */
    protected addDisplacementProperties(): void {
        Object.defineProperty(this, "displacementMap", {
            get: () => {
                return this.getDisplacementMap();
            },
            set: val => {
                this.setDisplacementMap(val);
            }
        });
    }

    /**
     * Apply the displacementMap value from the parameters to the respective properties.
     */
    protected applyDisplacementParameters(params?: DisplacementFeatureParameters) {
        linkMixinWithMaterial(this, this);

        assert(this.shaderDefines !== undefined);
        assert(this.shaderUniforms !== undefined);

        // Create uniforms with default values
        const uniforms = this.shaderUniforms!;
        uniforms.displacementMap = new THREE.Uniform(emptyTexture);
        uniforms.displacementScale = new THREE.Uniform(1);
        uniforms.displacementBias = new THREE.Uniform(0);
        uniforms.displacementUvTransform = new THREE.Uniform(new THREE.Matrix3());

        // Apply initial parameter values.
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
     * Copy displacementMap from other DisplacementFeature.
     *
     * @param source - The material to copy property values from.
     */
    protected copyDisplacementParameters(source: DisplacementFeature) {
        this.setDisplacementMap(source.displacementMap);
        return this;
    }
}

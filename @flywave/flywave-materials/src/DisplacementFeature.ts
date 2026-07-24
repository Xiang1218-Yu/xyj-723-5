/* Copyright (C) 2025 flywave.gl contributors */

import type * as THREE from "three";

import { type TileDisplacementMap } from "./DisplacementMap";
import { type HiddenThreeJSMaterialProperties, type MixinShaderProperties } from "./MapMeshMaterials";
import { type ShaderDefines } from "./ShaderTypes";

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
 * Interface to be implemented by materials that support a displacement map UV matrix uniform.
 */
export interface DisplacementMapUvSupport {
    displacementMapUvMatrix?: THREE.Matrix3;
}

/**
 * Interface to be implemented by materials that use displacement maps to overlay geometry
 * on elevation data.
 */
export interface DisplacementFeature extends HiddenThreeJSMaterialProperties {
    displacementMap: THREE.Texture | null;
}

/**
 * Determines whether a given material supports displacement maps for elevation overlay.
 *
 * @param material - The material to check (may be any value; typed as `unknown`).
 * @returns Whether the given material supports displacement maps for elevation overlay.
 */
export function hasDisplacementFeature(material: unknown): material is DisplacementFeature {
    return (
        typeof material === "object" &&
        material !== null &&
        "displacementMap" in material
    );
}

/**
 * Sets the displacement map to the given material.
 *
 * @param displacementMap - Tile displacement map instance, or `null` to clear.
 * @param material - The material to update.
 */
export function setDisplacementMapToMaterial(
    displacementMap: TileDisplacementMap | null,
    material: THREE.Material | THREE.Material[]
): void {
    if (Array.isArray(material)) {
        material.forEach(m => setDisplacementMapToMaterial(displacementMap, m));
        return;
    }

    if (!hasDisplacementFeature(material)) {
        return;
    }

    const targetMaterial = material as DisplacementFeature &
        MixinShaderProperties &
        DisplacementMapUvSupport;

    const newTexture = displacementMap?.texture ?? null;
    if (targetMaterial.displacementMap !== newTexture) {
        targetMaterial.displacementMap = newTexture as THREE.Texture;
        targetMaterial.displacementMapUvMatrix = displacementMap?.uvMatrix;
        targetMaterial.needsUpdate = true;
        if (targetMaterial.displacementMap !== null) {
            targetMaterial.displacementMap.needsUpdate = true;
        }
    }
}

/**
 * Re-export of the shader defines type for convenience in displacement feature consumers.
 */
export type { ShaderDefines };

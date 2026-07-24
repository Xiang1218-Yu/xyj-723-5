/* Copyright (C) 2025 flywave.gl contributors */

import { applyMixinsWithoutProperties, chainCallbacks } from "@flywave/flywave-utils";
import * as THREE from "three";

import {
    type DisplacementFeatureParameters,
    DisplacementFeature,
    DisplacementFeatureMixin
} from "./DisplacementFeature";
import {
    type ExtrusionFeatureParameters,
    ExtrusionFeature,
    ExtrusionFeatureMixin
} from "./ExtrusionFeature";
import {
    type FadingFeatureParameters,
    FadingFeature,
    FadingFeatureMixin
} from "./FadingFeature";
import { ExtrusionFeatureDefs } from "./MapMeshMaterialsDefs";
import { simpleLightingShadowChunk } from "./ShaderChunks/ShadowChunks";

/**
 * The MapMeshMaterials {@link MapMeshBasicMaterial} and {@link MapMeshStandardMaterial} are the
 * standard [[THREE.MeshBasicMaterial]] and [[THREE.MeshStandardMaterial]], with the additional
 * functionality of fading, extrusion and displacement.
 *
 * @remarks
 * This module now focuses on a single responsibility: the concrete map-mesh material classes.
 * The generic feature infrastructure has been split into dedicated modules following the
 * single-responsibility principle:
 * - shared types & linking helpers -> {@link ./MaterialFeatureTypes}
 * - fading feature -> {@link ./FadingFeature}
 * - extrusion feature -> {@link ./ExtrusionFeature}
 * - displacement feature -> {@link ./DisplacementFeature}
 *
 * The symbols below are re-exported so existing importers of `MapMeshMaterials` keep working
 * without any change (backward compatibility).
 */
export {
    type CompileCallback,
    type HiddenThreeJSMaterialProperties,
    type MixinShaderProperties,
    type UniformsType
} from "./MaterialFeatureTypes";
export {
    type FadingFeatureParameters,
    FadingFeature,
    FadingFeatureMixin
} from "./FadingFeature";
export {
    type ExtrusionFeatureParameters,
    ExtrusionFeature,
    ExtrusionFeatureMixin,
    hasExtrusionFeature
} from "./ExtrusionFeature";
export {
    type DisplacementFeatureParameters,
    DisplacementFeature,
    DisplacementFeatureMixin,
    hasDisplacementFeature,
    setDisplacementMapToMaterial
} from "./DisplacementFeature";

/**
 * Parameter used to control patching the standard material shader to ensure that the materials
 * color isn't affected by the light direction, only valid for techniques that are "fill"
 */
export interface ShadowFeatureParameters {
    /**
     * Whether the diffuse light component is removed (i.e. the materials color is therefore just
     * the ambient + shadow).
     */
    removeDiffuseLight?: boolean;
}

/**
 * Subclass of [[THREE.MeshBasicMaterial]]. Adds new properties required for [[fadeNear]] and
 * [[fadeFar]]. In addition to the new properties (which update their respective uniforms), it is
 * also required to update the material in their objects [[onBeforeRender]] and [[OnAfterRender]]
 * calls, where their flag [[transparent]] is set and the internal fadeNear/fadeFar values are
 * updated to world space distances.
 *
 * @see [[Tile#addRenderHelper]]
 */
export class MapMeshBasicMaterial
    extends THREE.MeshBasicMaterial
    implements FadingFeature, ExtrusionFeature, DisplacementFeature
{
    constructor(
        params?: THREE.MeshBasicMaterialParameters &
            FadingFeatureParameters &
            ExtrusionFeatureParameters &
            DisplacementFeatureParameters
    ) {
        super(params);

        FadingFeature.patchGlobalShaderChunks();
        this.addFadingProperties();
        this.applyFadingParameters(params);

        ExtrusionFeature.patchGlobalShaderChunks();
        this.addExtrusionProperties();
        this.applyExtrusionParameters({ ...params, zFightingWorkaround: true });

        this.addDisplacementProperties();
        this.applyDisplacementParameters(params);
    }

    clone(): this {
        // A freshly constructed material is copied from `this`; cast to `this` to satisfy the
        // covariant return type expected by THREE.Material.clone().
        return new MapMeshBasicMaterial().copy(this) as this;
    }

    copy(source: this): this {
        super.copy(source);
        this.copyFadingParameters(source);
        this.copyExtrusionParameters(source);
        this.copyDisplacementParameters(source);
        return this;
    }

    // Mixin implementations
    get fadeNear(): number {
        return FadingFeature.DEFAULT_FADE_NEAR;
    }

    set fadeNear(value: number) {}

    get fadeFar(): number {
        return FadingFeature.DEFAULT_FADE_FAR;
    }

    set fadeFar(value: number) {}

    get extrusionRatio(): number {
        return ExtrusionFeatureDefs.DEFAULT_RATIO_MAX;
    }

    set extrusionRatio(value: number) {}

    get displacementMap(): THREE.Texture | null {
        return null;
    }

    set displacementMap(value: THREE.Texture | null) {}

    setDisplacementMap(value: THREE.Texture | null) {}

    protected addFadingProperties(): void {}
    protected applyFadingParameters(params?: FadingFeatureParameters) {}
    protected copyFadingParameters(source: FadingFeature) {}
    protected addExtrusionProperties(): void {}
    protected applyExtrusionParameters(params?: ExtrusionFeatureParameters) {}
    protected copyExtrusionParameters(source: FadingFeature) {}
    protected addDisplacementProperties(): void {}
    protected applyDisplacementParameters(params?: DisplacementFeatureParameters) {}
    protected copyDisplacementParameters(source: DisplacementFeature) {}
}

export class MapMeshDepthMaterial extends THREE.MeshDepthMaterial implements ExtrusionFeature {
    constructor(params?: THREE.MeshDepthMaterialParameters & ExtrusionFeatureParameters) {
        super(params);

        ExtrusionFeature.patchGlobalShaderChunks();
        this.addExtrusionProperties();
        this.applyExtrusionParameters({ ...params, zFightingWorkaround: false });
    }

    // Mixin implementations
    get extrusionRatio(): number {
        return ExtrusionFeatureDefs.DEFAULT_RATIO_MAX;
    }

    set extrusionRatio(value: number) {}

    protected addExtrusionProperties(): void {}
    protected applyExtrusionParameters(params?: ExtrusionFeatureParameters) {}
    protected copyExtrusionParameters(source: FadingFeature) {}
}

/**
 * Subclass of THREE.MeshStandardMaterial. Adds new properties required for `fadeNear` and
 * `fadeFar`. In addition to the new properties (which fill respective uniforms), it is also
 * required to update the material in their objects `onBeforeRender` and `OnAfterRender` calls,
 * where their flag `transparent` is set and the internal fadeNear/fadeFar values are updated to
 * world space distances.
 *
 * @see [[Tile#addRenderHelper]]
 */
export class MapMeshStandardMaterial
    extends THREE.MeshStandardMaterial
    implements FadingFeature, ExtrusionFeature, DisplacementFeature
{
    uniformsNeedUpdate?: boolean;

    constructor(
        params?: THREE.MeshStandardMaterialParameters &
            FadingFeatureParameters &
            ExtrusionFeatureParameters &
            ShadowFeatureParameters
    ) {
        super(params);

        FadingFeature.patchGlobalShaderChunks();
        this.addFadingProperties();
        this.applyFadingParameters(params);

        ExtrusionFeature.patchGlobalShaderChunks();
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
        // A freshly constructed material is copied from `this`; cast to `this` to satisfy the
        // covariant return type expected by THREE.Material.clone().
        return new MapMeshStandardMaterial().copy(this) as this;
    }

    copy(source: this): this {
        super.copy(source);
        this.copyFadingParameters(source);
        this.copyExtrusionParameters(source);
        return this;
    }

    // Mixin implementations
    get fadeNear(): number {
        return FadingFeature.DEFAULT_FADE_NEAR;
    }

    set fadeNear(value: number) {}

    get fadeFar(): number {
        return FadingFeature.DEFAULT_FADE_FAR;
    }

    set fadeFar(value: number) {}

    get extrusionRatio(): number {
        return ExtrusionFeatureDefs.DEFAULT_RATIO_MAX;
    }

    set extrusionRatio(value: number) {}

    get displacementMap(): THREE.Texture | null {
        return null;
    }

    set displacementMap(value: THREE.Texture | null) {}

    get removeDiffuseLight(): boolean {
        return false;
    }

    set removeDiffuseLight(val: boolean) {}

    protected addFadingProperties(): void {}
    protected applyFadingParameters(params?: FadingFeatureParameters) {}
    protected copyFadingParameters(source: FadingFeature) {}
    protected addExtrusionProperties(): void {}
    protected applyExtrusionParameters(params?: ExtrusionFeatureParameters) {}
    protected copyExtrusionParameters(source: FadingFeature) {}
}

/**
 * Finish the classes MapMeshBasicMaterial and MapMeshStandardMaterial by assigning them the actual
 * implementations of the mixed in functions.
 */
applyMixinsWithoutProperties(MapMeshBasicMaterial, [FadingFeatureMixin]);
applyMixinsWithoutProperties(MapMeshStandardMaterial, [FadingFeatureMixin]);
applyMixinsWithoutProperties(MapMeshBasicMaterial, [ExtrusionFeatureMixin]);
applyMixinsWithoutProperties(MapMeshStandardMaterial, [ExtrusionFeatureMixin]);
applyMixinsWithoutProperties(MapMeshDepthMaterial, [ExtrusionFeatureMixin]);
applyMixinsWithoutProperties(MapMeshBasicMaterial, [DisplacementFeatureMixin]);

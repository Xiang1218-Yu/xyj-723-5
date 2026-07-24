/* Copyright (C) 2025 flywave.gl contributors */

import * as THREE from "three";

import { type ExtrusionFeature, type ExtrusionFeatureParameters } from "./ExtrusionFeature";
import { ExtrusionFeatureDefs } from "./MapMeshMaterialsDefs";

/**
 * [[THREE.MeshDepthMaterial]] 的子类，支持挤出效果。
 * 用于渲染建筑挤出的深度信息。
 */
export class MapMeshDepthMaterial
    extends THREE.MeshDepthMaterial
    implements ExtrusionFeature
{
    constructor(params?: THREE.MeshDepthMaterialParameters & ExtrusionFeatureParameters) {
        super(params);

        this.addExtrusionProperties();
        this.applyExtrusionParameters({ ...params, zFightingWorkaround: false });
    }

    // Mixin implementations - overwritten by applyMixinsWithoutProperties in barrel file
    get extrusionRatio(): number { return ExtrusionFeatureDefs.DEFAULT_RATIO_MAX; }
    set extrusionRatio(value: number) {}

    protected addExtrusionProperties(): void {}
    protected applyExtrusionParameters(params?: ExtrusionFeatureParameters): void {}
    protected copyExtrusionParameters(source: ExtrusionFeature): this { return this; }
}

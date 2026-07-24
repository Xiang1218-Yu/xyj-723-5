/* Copyright (C) 2025 flywave.gl contributors */

import * as THREE from "three";

import {
    type ExtrusionFeatureParameters,
    ExtrusionFeature
} from "./ExtrusionFeature";
import {
    type DisplacementFeatureParameters,
    DisplacementFeature
} from "./DisplacementFeature";
import {
    type FadingFeatureParameters,
    FadingFeature
} from "./FadingFeature";

/**
 * [[THREE.MeshBasicMaterial]] 的子类。
 * 添加了 [[fadeNear]] 和 [[fadeFar]] 所需的新属性。
 * 除了新属性外，还需要在对象的 [[onBeforeRender]] 和 [[onAfterRender]]
 * 调用中更新材质，设置 [[transparent]] 标志并更新世界空间距离值。
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

        this.addFadingProperties();
        this.applyFadingParameters(params);

        this.addExtrusionProperties();
        this.applyExtrusionParameters({ ...params, zFightingWorkaround: true });

        this.addDisplacementProperties();
        this.applyDisplacementParameters(params);
    }

    clone(): this {
        return new MapMeshBasicMaterial().copy(this) as this;
    }

    copy(source: this): this {
        super.copy(source);
        this.copyFadingParameters(source);
        this.copyExtrusionParameters(source);
        this.copyDisplacementParameters(source);
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

    setDisplacementMap(value: THREE.Texture | null): void {}
    protected addFadingProperties(): void {}
    protected applyFadingParameters(params?: FadingFeatureParameters): void {}
    protected copyFadingParameters(source: FadingFeature): this { return this; }
    protected addExtrusionProperties(): void {}
    protected applyExtrusionParameters(params?: ExtrusionFeatureParameters): void {}
    protected copyExtrusionParameters(source: ExtrusionFeature): this { return this; }
    protected addDisplacementProperties(): void {}
    protected applyDisplacementParameters(params?: DisplacementFeatureParameters): void {}
    protected copyDisplacementParameters(source: DisplacementFeature): this { return this; }
}

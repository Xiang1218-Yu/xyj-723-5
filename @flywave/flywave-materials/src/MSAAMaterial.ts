/* Copyright (C) 2025 flywave.gl contributors */

import * as THREE from "three";

import { CopyShader, type CopyShaderUniforms } from "./CopyMaterial";

/**
 * The material to use for the quad of the {@link @flywave/flywave-mapview#MSAARenderPass}
 * in the composing.
 */
export class MSAAMaterial extends THREE.ShaderMaterial {
    /**
     * The constructor of `MSAAMaterial`.
     *
     * @param uniforms - The {@link CopyShader}'s uniforms.
     */
    constructor(uniforms: CopyShaderUniforms) {
        super({
            uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
            vertexShader: CopyShader.vertexShader,
            fragmentShader: CopyShader.fragmentShader,
            premultipliedAlpha: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false
        });
    }
}

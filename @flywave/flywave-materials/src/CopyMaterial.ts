/* Copyright (C) 2025 flywave.gl contributors */

import * as THREE from "three";

/**
 * Uniforms declared by the {@link CopyShader} program.
 */
export interface CopyShaderUniforms {
    tDiffuse: THREE.IUniform<THREE.Texture | null>;
    opacity: THREE.IUniform<number>;
}

/**
 * The base shader to use for {@link @flywave/flywave-mapview#MapView}'s
 * composing passes, like {@link MSAAMaterial}.
 *
 * @remarks
 * The uniforms object is strongly typed through {@link CopyShaderUniforms}
 * so material classes can reference individual uniforms without `any` casts.
 */
export const CopyShader: THREE.ShaderMaterialParameters & {
    uniforms: CopyShaderUniforms;
} = {
    uniforms: {
        tDiffuse: { value: null },
        opacity: { value: 1.0 }
    },
    vertexShader: `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`,
    fragmentShader: `
    uniform float opacity;
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
        vec4 texel = texture2D( tDiffuse, vUv );
        gl_FragColor = opacity * texel;
    }`
};

/**
 * The material is used for composing.
 */
export class CopyMaterial extends THREE.ShaderMaterial {
    /**
     * The constructor of `CopyMaterial`.
     *
     * @param uniforms - The {@link CopyShader}'s uniforms.
     */
    constructor(uniforms: CopyShaderUniforms) {
        super({
            name: "CopyMaterial",
            uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
            vertexShader: CopyShader.vertexShader,
            fragmentShader: CopyShader.fragmentShader,
            premultipliedAlpha: true,
            transparent: false,
            blending: THREE.NoBlending,
            depthTest: false,
            depthWrite: false
        });
    }
}

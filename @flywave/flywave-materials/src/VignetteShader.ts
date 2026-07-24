/* Copyright (C) 2025 flywave.gl contributors */

import type * as THREE from "three";

/**
 * Uniforms declared by the {@link VignetteShader} program.
 */
export interface VignetteShaderUniforms {
    tDiffuse: THREE.IUniform<THREE.Texture | null>;
    offset: THREE.IUniform<number>;
    darkness: THREE.IUniform<number>;
}

/**
 * `VignetteShader` parameters with strongly-typed uniforms.
 */
export type VignetteShaderParameters = THREE.ShaderMaterialParameters & {
    uniforms: VignetteShaderUniforms;
};

/**
 * `VignetteShader`.
 */
export const VignetteShader: VignetteShaderParameters = {
    uniforms: {
        tDiffuse: { value: null },
        offset: { value: 1.0 },
        darkness: { value: 1.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
    fragmentShader: `
        uniform float offset;
        uniform float darkness;
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        void main() {
            vec4 texel = texture2D( tDiffuse, vUv );
            vec2 uv = ( vUv - vec2( 0.5 ) ) * vec2( offset );
            gl_FragColor = vec4( mix( texel.rgb, vec3( 1.0 - darkness ), dot( uv, uv ) ), texel.a );
        }`
};

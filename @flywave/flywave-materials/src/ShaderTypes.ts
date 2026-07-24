/* Copyright (C) 2025 flywave.gl contributors */

import * as THREE from "three";

/**
 * Shader preprocessor define value type.
 *
 * @remarks
 * Shader defines support two semantic kinds:
 * - boolean: `true` sets the define to an empty string (for `#ifdef`), `false` removes it
 * - number: sets an explicit numeric value (for `#if` / `#elif` comparisons)
 */
export type ShaderDefineValue = boolean | number;

/**
 * Type-safe map of shader preprocessor defines.
 *
 * @remarks
 * Replaces the previous `Record<string, any>` pattern used throughout the material system.
 * Keys are define names as used in GLSL (`USE_FOG`, `USE_DISPLACEMENTMAP`, etc.),
 * values are either:
 * - empty string `""` ({@link DEFINE_BOOL_TRUE}) for boolean defines set via helper
 * - `undefined` ({@link DEFINE_BOOL_FALSE}) for removed boolean defines
 * - a `number` for numeric defines
 * - a `boolean` `true`/`false` which THREE.js natively interprets (enable/skip define)
 *
 * Note: both `true` and `""` are valid "defined" states; `false` and `undefined` both
 * mean "not defined". The two encodings coexist because some code paths use the
 * {@link setShaderDefine} helper (which writes `""`/`undefined`) while others assign
 * boolean literals directly (which THREE.js handles natively during shader compilation).
 */
export type ShaderDefines = Record<string, string | number | boolean | undefined>;

/**
 * Typed shader compilation callback used by `onBeforeCompile`.
 *
 * @remarks
 * This replaces the previous `CompileCallback` that used `any` for the renderer parameter.
 */
export type ShaderCompileCallback = (
    shader: THREE.WebGLProgramParametersWithUniforms,
    renderer: THREE.WebGLRenderer
) => void;

/**
 * Typed dictionary of THREE.js shader uniforms.
 *
 * @remarks
 * A convenience alias over `Record<string, THREE.IUniform>` used by material classes
 * to declare custom uniform maps without falling back to `any`.
 */
export type UniformsMap = Record<string, THREE.IUniform>;

/**
 * Minimal interface describing a THREE.js object that may carry a geometry and material,
 * used for safe disposal helpers without casting through `any`.
 */
export interface DisposableRenderable {
    geometry?: { dispose(): void };
    material?: THREE.Material | THREE.Material[];
}

/**
 * Dispose geometry and material(s) attached to a renderable object in a type-safe manner.
 *
 * @param renderable - Object optionally holding geometry and material references.
 *
 * @remarks
 * Centralises the pattern previously expressed as `(obj as any).geometry?.dispose()`
 * followed by manual array/non-array branching over `material`.
 */
export function disposeRenderable(renderable: DisposableRenderable): void {
    renderable.geometry?.dispose();

    if (Array.isArray(renderable.material)) {
        renderable.material.forEach(mat => mat.dispose());
    } else if (renderable.material) {
        renderable.material.dispose();
    }
}

/* Copyright (C) 2025 flywave.gl contributors */

import * as THREE from "three";

/**
 * A collection of named GLSL shader chunks, keyed by the `#include <name>` identifier used inside
 * THREE.js shaders. This mirrors the shape of the objects exported by the files in this folder
 * (e.g. {@link FadingChunks}, {@link ExtrusionChunks}).
 */
export type ShaderChunkMap = Record<string, string>;

/**
 * Centralized, idempotent registry for injecting custom GLSL chunks into the global
 * `THREE.ShaderChunk` map.
 *
 * @remarks
 * Historically each material/feature patched `THREE.ShaderChunk` on its own via ad-hoc
 * `Object.assign(THREE.ShaderChunk, ...)` calls guarded by hand-written `undefined` checks. That
 * spread the registration responsibility across many modules and made it easy to register the same
 * chunks repeatedly or forget the guard entirely.
 *
 * This registry is the single owner of that responsibility (single-responsibility principle): every
 * feature registers its chunks through {@link ShaderChunkRegistry.register}, which guarantees the
 * chunks are merged into `THREE.ShaderChunk` exactly once per unique registration key.
 */
export namespace ShaderChunkRegistry {
    /**
     * Keys of chunk bundles that have already been merged into `THREE.ShaderChunk`.
     * Used to make {@link register} idempotent regardless of how many materials request it.
     */
    const registeredKeys = new Set<string>();

    /**
     * Register a bundle of shader chunks into the global `THREE.ShaderChunk` map exactly once.
     *
     * @param key - Unique identifier of the chunk bundle (e.g. `"fading"`, `"extrusion"`). Repeated
     * calls with the same key are no-ops, so this is safe to call from every material constructor.
     * @param chunks - The named GLSL chunks to merge into `THREE.ShaderChunk`.
     * @returns `true` if the chunks were merged by this call, `false` if they were already present.
     */
    export function register(key: string, chunks: ShaderChunkMap): boolean {
        if (registeredKeys.has(key)) {
            return false;
        }
        Object.assign(THREE.ShaderChunk, chunks);
        registeredKeys.add(key);
        return true;
    }

    /**
     * Returns whether a chunk bundle with the given key has already been registered.
     *
     * @param key - The chunk bundle identifier.
     */
    export function isRegistered(key: string): boolean {
        return registeredKeys.has(key);
    }

    /**
     * Clears the internal registration bookkeeping. Intended for tests that need a pristine
     * registry; it does not remove chunks already merged into `THREE.ShaderChunk`.
     */
    export function reset(): void {
        registeredKeys.clear();
    }
}

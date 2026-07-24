/* Copyright (C) 2025 flywave.gl contributors */

import * as THREE from "three";

import { type ShaderDefines } from "./ShaderTypes";

/**
 * Describes a single shader program managed by {@link ShaderRegistry}.
 *
 * @remarks
 * Each shader definition bundles its GLSL source, default uniforms and the initial
 * set of preprocessor defines. The registry owns the lifecycle (registration,
 * retrieval and optional patching of global `THREE.ShaderChunk`s).
 */
export interface ShaderDefinition {
    /** Unique name used to register and retrieve the shader. */
    readonly name: string;

    /** Vertex shader GLSL source. */
    readonly vertexShader: string;

    /** Fragment shader GLSL source. */
    readonly fragmentShader: string;

    /** Default uniforms (will be cloned via `THREE.UniformsUtils.clone` on each material). */
    readonly uniforms?: Record<string, THREE.IUniform>;

    /** Initial preprocessor defines applied before the first compile. */
    readonly defines?: ShaderDefines;
}

/**
 * Central registry for shader definitions used across the material system.
 *
 * @remarks
 * The registry enforces the **single responsibility principle** for shader management:
 * - It is the only place where shader sources are registered and looked up.
 * - Material classes reference shaders by name rather than embedding raw GLSL strings.
 * - It provides a single extension point (`registerChunk`) for injecting reusable
 *   GLSL chunks into `THREE.ShaderChunk`, preventing scattered `Object.assign` calls.
 *
 * The class is intentionally stateless beyond its internal maps; it does not own
 * any GPU resources and can be used as a singleton ({@link shaderRegistry}).
 */
export class ShaderRegistry {
    private readonly shaders = new Map<string, ShaderDefinition>();
    private readonly registeredChunks = new Set<string>();

    /**
     * Register a shader definition.
     *
     * @param definition - The shader descriptor to register.
     * @throws If a shader with the same name has already been registered.
     */
    register(definition: ShaderDefinition): void {
        if (this.shaders.has(definition.name)) {
            throw new Error(`Shader "${definition.name}" is already registered.`);
        }
        this.shaders.set(definition.name, definition);
    }

    /**
     * Register a shader definition, replacing any previously registered shader with the same name.
     *
     * @param definition - The shader descriptor to register.
     */
    registerOrReplace(definition: ShaderDefinition): void {
        this.shaders.set(definition.name, definition);
    }

    /**
     * Retrieve a registered shader definition by name.
     *
     * @param name - The shader name used at registration time.
     * @returns The matching {@link ShaderDefinition}, or `undefined` if not found.
     */
    get(name: string): ShaderDefinition | undefined {
        return this.shaders.get(name);
    }

    /**
     * Check whether a shader with the given name has been registered.
     *
     * @param name - Shader name to look up.
     */
    has(name: string): boolean {
        return this.shaders.has(name);
    }

    /**
     * Create a deep clone of the default uniforms for a registered shader.
     *
     * @param name - Shader name.
     * @returns A fresh `Record<string, THREE.IUniform>` ready for material use.
     */
    cloneUniforms(name: string): Record<string, THREE.IUniform> {
        const def = this.shaders.get(name);
        if (!def || !def.uniforms) {
            return {};
        }
        return THREE.UniformsUtils.clone(def.uniforms);
    }

    /**
     * Return the initial defines declared by the shader definition.
     *
     * @param name - Shader name.
     * @returns A fresh copy of the defines object, or an empty object.
     */
    defaultDefines(name: string): ShaderDefines {
        const def = this.shaders.get(name);
        return def?.defines ? { ...def.defines } : {};
    }

    /**
     * Register GLSL chunks into the global `THREE.ShaderChunk` map.
     *
     * @remarks
     * Chunks are registered idempotently – each named chunk is installed at most once,
     * matching the previous scattered `if (THREE.ShaderChunk[x] === undefined)` guards.
     *
     * @param chunks - Map of chunk name to GLSL source.
     */
    registerChunks(chunks: Record<string, string>): void {
        for (const [chunkName, chunkSource] of Object.entries(chunks)) {
            if (this.registeredChunks.has(chunkName)) {
                continue;
            }
            THREE.ShaderChunk[chunkName] = chunkSource;
            this.registeredChunks.add(chunkName);
        }
    }

    /**
     * Iterate over all registered shader definitions.
     */
    list(): IterableIterator<ShaderDefinition> {
        return this.shaders.values();
    }
}

/**
 * Process-wide singleton {@link ShaderRegistry}.
 *
 * @remarks
 * Materials and post-processing passes should register their shaders here during
 * module initialisation so that other systems can look them up by name without
 * creating hard import cycles to raw GLSL strings.
 */
export const shaderRegistry = new ShaderRegistry();

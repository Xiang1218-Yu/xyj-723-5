/* Copyright (C) 2025 flywave.gl contributors */

import * as THREE from "three";

import atmosphereChunks from "./ShaderChunks/AtmosphereChunks";
import atmosphericScatteringChunks from "./ShaderChunks/AtmosphericScatteringChunks";
import extrusionChunks from "./ShaderChunks/ExtrusionChunks";
import fadingChunks from "./ShaderChunks/FadingChunks";
import highPrecisionLineChunks from "./ShaderChunks/LinesChunks";
import * as shadowChunks from "./ShaderChunks/ShadowChunks";

/**
 * Shader Chunk 描述符接口
 * 描述单个 shader chunk 的注册信息
 */
export interface ShaderChunkDescriptor {
    /** Chunk 名称（用于 THREE.ShaderChunk 中的键名） */
    name: string;
    /** Chunk GLSL 源码 */
    source: string;
}

/**
 * Shader Chunk 组接口
 * 一组相关的 shader chunks 集合
 */
export interface ShaderChunkGroup {
    /** 组名称 */
    groupName: string;
    /** 组内所有 chunks */
    chunks: ShaderChunkDescriptor[];
}

/**
 * Shader Chunk 注册表项
 * 记录已注册 chunk 的元信息
 */
interface RegisteredChunk {
    /** chunk 名称 */
    name: string;
    /** 所属组名 */
    groupName: string;
    /** 是否已注册到 THREE.ShaderChunk */
    registered: boolean;
}

/**
 * Shader Chunk 管理器
 *
 * 职责：
 * - 统一管理所有自定义 shader chunk 的注册和注销
 * - 提供 chunk 分组管理，支持按组注册/注销
 * - 防止重复注册，确保 chunk 只在需要时注入到 THREE.ShaderChunk
 * - 支持运行时查询已注册的 chunk
 *
 * 设计原则：
 * - 单一职责：仅负责 shader chunk 的注册管理
 * - 类型安全：所有 chunk 描述符都有明确类型
 * - 延迟注册：chunk 只在首次请求时注册，避免不必要的全局污染
 */
export class ShaderChunkManager {
    /**
     * 单例实例
     */
    private static instance: ShaderChunkManager | null = null;

    /**
     * 已注册 chunk 映射表
     * 键为 chunk 名称，值为注册信息
     */
    private readonly registeredChunks = new Map<string, RegisteredChunk>();

    /**
     * 所有已知的 chunk 组
     * 键为组名，值为 chunk 描述符数组
     */
    private readonly chunkGroups = new Map<string, ShaderChunkDescriptor[]>();

    /**
     * 私有构造函数（单例模式）
     * 初始化时预注册所有内置 chunk 组
     */
    private constructor() {
        this.preRegisterBuiltinGroups();
    }

    /**
     * 获取 ShaderChunkManager 单例
     * @returns ShaderChunkManager 实例
     */
    public static getInstance(): ShaderChunkManager {
        if (ShaderChunkManager.instance === null) {
            ShaderChunkManager.instance = new ShaderChunkManager();
        }
        return ShaderChunkManager.instance;
    }

    /**
     * 预注册内置 chunk 组
     * 将所有模块导入的 chunk 组登记到管理器中（但不立即注入 THREE.ShaderChunk）
     */
    private preRegisterBuiltinGroups(): void {
        this.registerChunkGroup("atmosphere", atmosphereChunks);
        this.registerChunkGroup("atmosphericScattering", atmosphericScatteringChunks);
        this.registerChunkGroup("extrusion", extrusionChunks);
        this.registerChunkGroup("fading", fadingChunks);
        this.registerChunkGroup("highPrecisionLines", highPrecisionLineChunks);
        this.registerChunkGroup("shadow", shadowChunks);
    }

    /**
     * 注册一个 chunk 组
     *
     * @param groupName - 组名称
     * @param chunksObj - 包含 chunk 键值对的对象（通常为 import 的默认导出）
     */
    public registerChunkGroup(groupName: string, chunksObj: Record<string, string>): void {
        const descriptors: ShaderChunkDescriptor[] = Object.entries(chunksObj).map(
            ([name, source]) => ({
                name,
                source
            })
        );
        this.chunkGroups.set(groupName, descriptors);

        for (const desc of descriptors) {
            if (!this.registeredChunks.has(desc.name)) {
                this.registeredChunks.set(desc.name, {
                    name: desc.name,
                    groupName,
                    registered: false
                });
            }
        }
    }

    /**
     * 注册指定组中的所有 chunks 到 THREE.ShaderChunk
     *
     * @param groupName - 要注册的组名称
     * @returns 实际新注册的 chunk 数量
     *
     * @example
     * ```typescript
     * ShaderChunkManager.getInstance().registerGroup("fading");
     * ShaderChunkManager.getInstance().registerGroup("extrusion");
     * ```
     */
    public registerGroup(groupName: string): number {
        const descriptors = this.chunkGroups.get(groupName);
        if (!descriptors) {
            console.warn(`ShaderChunkManager: Unknown chunk group "${groupName}"`);
            return 0;
        }

        let registered = 0;
        for (const desc of descriptors) {
            const record = this.registeredChunks.get(desc.name);
            if (record && !record.registered) {
                THREE.ShaderChunk[desc.name] = desc.source;
                record.registered = true;
                registered++;
            }
        }

        return registered;
    }

    /**
     * 注销指定组的所有 chunks（从 THREE.ShaderChunk 中移除）
     *
     * @param groupName - 要注销的组名称
     * @returns 实际注销的 chunk 数量
     */
    public unregisterGroup(groupName: string): number {
        const descriptors = this.chunkGroups.get(groupName);
        if (!descriptors) {
            return 0;
        }

        let unregistered = 0;
        for (const desc of descriptors) {
            const record = this.registeredChunks.get(desc.name);
            if (record && record.registered) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete THREE.ShaderChunk[desc.name];
                record.registered = false;
                unregistered++;
            }
        }

        return unregistered;
    }

    /**
     * 注册单个 chunk（如果尚未注册）
     *
     * @param name - chunk 名称
     * @param source - chunk GLSL 源码
     * @param groupName - 所属组名（默认为 "custom"）
     * @returns 是否成功注册（已存在则返回 false）
     */
    public registerChunk(name: string, source: string, groupName: string = "custom"): boolean {
        if (this.registeredChunks.has(name)) {
            const record = this.registeredChunks.get(name)!;
            if (!record.registered) {
                THREE.ShaderChunk[name] = source;
                record.registered = true;
                return true;
            }
            return false;
        }

        THREE.ShaderChunk[name] = source;
        this.registeredChunks.set(name, {
            name,
            groupName,
            registered: true
        });

        if (!this.chunkGroups.has(groupName)) {
            this.chunkGroups.set(groupName, [{ name, source }]);
        } else {
            this.chunkGroups.get(groupName)!.push({ name, source });
        }

        return true;
    }

    /**
     * 确保指定组的 chunks 已注册（幂等操作）
     *
     * @param groupNames - 一个或多个组名称
     *
     * 这是最常用的 API，在材质构造函数中调用以确保所需的 chunks 可用
     *
     * @example
     * ```typescript
     * // 在材质构造函数中
     * ShaderChunkManager.ensureRegistered("fading", "extrusion");
     * ```
     */
    public ensureRegistered(...groupNames: string[]): void {
        for (const groupName of groupNames) {
            this.registerGroup(groupName);
        }
    }

    /**
     * 检查指定 chunk 是否已注册到 THREE.ShaderChunk
     *
     * @param name - chunk 名称
     * @returns 是否已注册
     */
    public isChunkRegistered(name: string): boolean {
        const record = this.registeredChunks.get(name);
        return record?.registered ?? false;
    }

    /**
     * 检查指定组是否已完全注册
     *
     * @param groupName - 组名称
     * @returns 组内所有 chunks 是否已注册
     */
    public isGroupRegistered(groupName: string): boolean {
        const descriptors = this.chunkGroups.get(groupName);
        if (!descriptors || descriptors.length === 0) {
            return false;
        }
        return descriptors.every(d => this.isChunkRegistered(d.name));
    }

    /**
     * 获取指定 chunk 的 GLSL 源码
     *
     * @param name - chunk 名称
     * @returns GLSL 源码字符串，未找到返回 undefined
     */
    public getChunkSource(name: string): string | undefined {
        for (const descriptors of this.chunkGroups.values()) {
            const desc = descriptors.find(d => d.name === name);
            if (desc) {
                return desc.source;
            }
        }
        return undefined;
    }

    /**
     * 获取所有已注册组的名称列表
     *
     * @returns 组名称数组
     */
    public getRegisteredGroupNames(): string[] {
        return Array.from(this.chunkGroups.keys());
    }

    /**
     * 获取指定组内的所有 chunk 名称
     *
     * @param groupName - 组名称
     * @returns chunk 名称数组
     */
    public getChunkNamesInGroup(groupName: string): string[] {
        const descriptors = this.chunkGroups.get(groupName);
        return descriptors?.map(d => d.name) ?? [];
    }

    /**
     * 重置管理器（主要用于测试）
     * 注销所有已注册的 chunks 并清空组
     */
    public reset(): void {
        for (const [name, record] of this.registeredChunks) {
            if (record.registered) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete THREE.ShaderChunk[name];
            }
        }
        this.registeredChunks.clear();
        this.chunkGroups.clear();
        this.preRegisterBuiltinGroups();
    }
}

/**
 * 便捷函数：确保指定的 shader chunk 组已注册
 *
 * @param groupNames - 要确保注册的组名称列表
 *
 * @example
 * ```typescript
 * import { ensureShaderChunks } from "./ShaderChunkManager";
 *
 * // 在材质构造函数中
 * ensureShaderChunks("fading", "extrusion");
 * ```
 */
export function ensureShaderChunks(...groupNames: string[]): void {
    ShaderChunkManager.getInstance().ensureRegistered(...groupNames);
}

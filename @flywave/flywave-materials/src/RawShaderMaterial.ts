/* Copyright (C) 2025 flywave.gl contributors */

import { convertFragmentShaderToWebGL2, convertVertexShaderToWebGL2 } from "@flywave/flywave-utils";
import * as THREE from "three";

import { getShaderMaterialDefine, setShaderMaterialDefine } from "./Utils";

/**
 * RawShaderMaterial 参数接口
 * 包含渲染器能力信息
 */
export interface RendererMaterialParameters {
    /** WebGL 渲染器能力信息 */
    rendererCapabilities: THREE.WebGLCapabilities;
}

/**
 * RawShaderMaterial 构造参数
 * 继承自 THREE.ShaderMaterialParameters 并添加 rendererCapabilities
 */
export interface RawShaderMaterialParameters
    extends RendererMaterialParameters,
        THREE.ShaderMaterialParameters {}

/**
 * 内部 Shader 参数类型（移除了 rendererCapabilities）
 * 用于传递给 THREE.RawShaderMaterial 构造函数
 */
type InternalShaderParameters = Omit<RawShaderMaterialParameters, "rendererCapabilities">;

/**
 * 所有原始着色器材质的基类
 *
 * 职责：
 * - 确保 WebGL1 着色器与 WebGL2 兼容
 * - 自动处理着色器版本转换
 * - 管理 fog 和对数深度缓冲区的 shader defines
 * - 类型安全的参数处理
 */
export class RawShaderMaterial extends THREE.RawShaderMaterial {
    /**
     * 构造函数
     *
     * @param params - RawShaderMaterial 参数，克隆时可选
     */
    constructor(params?: RawShaderMaterialParameters) {
        const isWebGL2 = params?.rendererCapabilities.isWebGL2 === true;

        let shaderParams: InternalShaderParameters | undefined;

        if (params) {
            const { rendererCapabilities: _caps, ...restParams } = params;
            void _caps;

            shaderParams = {
                ...restParams,
                glslVersion: isWebGL2 ? THREE.GLSL3 : THREE.GLSL1,
                vertexShader:
                    isWebGL2 && params.vertexShader
                        ? convertVertexShaderToWebGL2(params.vertexShader)
                        : params.vertexShader,
                fragmentShader:
                    isWebGL2 && params.fragmentShader
                        ? convertFragmentShaderToWebGL2(params.fragmentShader)
                        : params.fragmentShader
            };
        }

        super(shaderParams as THREE.ShaderMaterialParameters);
        this.invalidateFog();
        this.invalidateLogarithmicDepthBuffer(
            params?.rendererCapabilities.logarithmicDepthBuffer === true
        );
        this.setOpacity(shaderParams?.opacity);
    }

    /**
     * 检查并更新 fog 的 shader define
     */
    invalidateFog(): void {
        if (this.defines !== undefined && this.fog !== getShaderMaterialDefine(this, "USE_FOG")) {
            setShaderMaterialDefine(this, "USE_FOG", this.fog);
        }
    }

    /**
     * 检查并更新对数深度缓冲区的 shader define
     *
     * @param logarithmicDepthBuffer - 是否启用对数深度缓冲区
     */
    invalidateLogarithmicDepthBuffer(logarithmicDepthBuffer: boolean): void {
        if (
            this.defines !== undefined &&
            logarithmicDepthBuffer !== getShaderMaterialDefine(this, "USE_LOGDEPTHBUF")
        ) {
            setShaderMaterialDefine(this, "USE_LOGDEPTHBUF", logarithmicDepthBuffer);
        }
    }

    /**
     * 设置材质的 opacity 属性，并在需要时更新 uniforms 的 opacity 值
     *
     * @param opacity - 不透明度值，undefined 则不设置
     */
    setOpacity(opacity?: number): void {
        if (opacity !== undefined) {
            this.opacity = opacity;
            if (this.uniforms?.opacity) {
                this.uniforms.opacity.value = opacity;
            }
        }
    }
}

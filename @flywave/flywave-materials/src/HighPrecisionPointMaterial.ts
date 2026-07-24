/* Copyright (C) 2025 flywave.gl contributors */

import * as THREE from "three";

import linesShaderChunk from "./ShaderChunks/LinesChunks";

const vertexSource: string = `
#ifdef USE_COLOR
varying vec3 vColor;
#endif

uniform float size;

// uniforms to implement double-precision
uniform mat4 u_mvp;             // combined modelView and projection matrix
uniform vec3 u_eyepos;          // eye position major
uniform vec3 u_eyepos_lowpart;  // eye position minor ((double) eyepos - (float) eyepos)

// vertex attributes
attribute vec3 positionLow;     // low part

#include <high_precision_vert_func>

void main() {
    #ifdef USE_COLOR
    vColor = color.rgb;
    #endif

    vec3 pos = subtractDblEyePos(position);
    gl_Position = u_mvp * vec4(pos, 1.0);

    // ignore sizeAttenuation for now!
    gl_PointSize = size;
}`;

/**
 * HighPrecisionPointMaterial 构造参数
 */
export interface HighPrecisionPointMaterialParameters extends THREE.PointsMaterialParameters {
    /**
     * 点颜色
     */
    color?: THREE.ColorRepresentation;
    /**
     * 点不透明度
     */
    opacity?: number;
    /**
     * 点缩放
     */
    scale?: number;
    /**
     * UV 变换矩阵
     */
    uvTransform?: THREE.Matrix3;
}

/**
 * 用于渲染高精度点的材质（适用于位置敏感数据）
 *
 * 职责：
 * - 提供双精度顶点位置支持
 * - 管理颜色、大小、缩放和 UV 变换 uniforms
 * - 类型安全的参数处理
 */
export class HighPrecisionPointMaterial extends THREE.PointsMaterial {
    static readonly DEFAULT_COLOR: number = 0x000050;
    static readonly DEFAULT_OPACITY: number = 1.0;
    static readonly DEFAULT_SIZE: number = 1.0;
    static readonly DEFAULT_SCALE: number = 1.0;

    /**
     * 类型标记，用于 isHighPrecisionPointMaterial 类型守卫
     */
    isHighPrecisionPointMaterial: boolean;

    /**
     * 着色器 uniforms
     */
    uniforms: Record<string, THREE.IUniform>;

    /**
     * 顶点着色器源码
     */
    vertexShader?: string;

    /**
     * 片元着色器源码
     */
    fragmentShader?: string;

    /**
     * 构造函数
     *
     * @param params - HighPrecisionPointMaterial 参数
     */
    constructor(params?: HighPrecisionPointMaterialParameters) {
        Object.assign(THREE.ShaderChunk, linesShaderChunk);

        super(params);

        this.vertexShader = vertexSource;
        this.fragmentShader = THREE.ShaderChunk.points_frag;
        this.fog = false;

        this.uniforms = {
            diffuseColor: new THREE.Uniform(
                new THREE.Color(HighPrecisionPointMaterial.DEFAULT_COLOR)
            ),
            opacity: new THREE.Uniform(HighPrecisionPointMaterial.DEFAULT_OPACITY),
            size: new THREE.Uniform(HighPrecisionPointMaterial.DEFAULT_SIZE),
            scale: new THREE.Uniform(HighPrecisionPointMaterial.DEFAULT_SCALE),
            map: new THREE.Uniform(new THREE.Texture()),
            uvTransform: new THREE.Uniform(new THREE.Matrix3()),
            u_mvp: new THREE.Uniform(new THREE.Matrix4()),
            u_eyepos: new THREE.Uniform(new THREE.Vector3()),
            u_eyepos_lowpart: new THREE.Uniform(new THREE.Vector3())
        };

        this.isHighPrecisionPointMaterial = true;

        if (params !== undefined) {
            if (params.color !== undefined) {
                this.color.set(params.color);
            }
            if (params.opacity !== undefined) {
                this.opacity = params.opacity;
            }
            if (params.size !== undefined) {
                this.size = params.size;
            }
            if (params.scale !== undefined) {
                this.scale = params.scale;
            }
            if (params.uvTransform !== undefined) {
                this.uvTransform = params.uvTransform;
            }
            if (params.map !== undefined) {
                this.map = params.map;
            }
        }
    }

    /**
     * 点缩放
     */
    get scale(): number {
        return this.uniforms.scale.value as number;
    }

    set scale(value: number) {
        this.uniforms.scale.value = value;
    }

    /**
     * UV 变换矩阵
     */
    get uvTransform(): THREE.Matrix3 {
        return this.uniforms.uvTransform.value as THREE.Matrix3;
    }

    set uvTransform(value: THREE.Matrix3) {
        this.uniforms.uvTransform.value = value;
    }
}

/**
 * 类型守卫：检查材质是否为 HighPrecisionPointMaterial
 *
 * @param material - 待检查的材质对象
 * @returns 是否为 HighPrecisionPointMaterial
 */
export function isHighPrecisionPointMaterial(
    material: object | undefined
): material is HighPrecisionPointMaterial {
    return (
        material !== undefined &&
        (material as HighPrecisionPointMaterial).isHighPrecisionPointMaterial === true
    );
}

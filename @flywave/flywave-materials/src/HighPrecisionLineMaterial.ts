/* Copyright (C) 2025 flywave.gl contributors */

import * as THREE from "three";

import { type RawShaderMaterialParameters, RawShaderMaterial } from "./RawShaderMaterial";
import linesShaderChunk from "./ShaderChunks/LinesChunks";

const vertexSource: string = `
#ifdef USE_COLOR
attribute vec4 color;
varying vec3 vColor;
#endif

#include <common>  
// uniforms to implement double-precision
uniform mat4 u_mvp;             // combined modelView and projection matrix
uniform vec3 u_eyepos;          // eye position major
uniform vec3 u_eyepos_lowpart;  // eye position minor ((double) eyepos - (float) eyepos)

// vertex attributes
attribute vec3 position;        // high part
attribute vec3 positionLow;     // low part

#include <high_precision_vert_func>
#include <logdepthbuf_pars_vertex>

void main() {
    #ifdef USE_COLOR
    vColor = color.rgb;
    #endif

    vec3 pos = subtractDblEyePos(position);
    gl_Position = u_mvp * vec4(pos, 1.0);
    #include <logdepthbuf_vertex>
}`;

const fragmentSource: string = `
precision highp float;
precision highp int;

#include <common>  
uniform vec3 diffuseColor;
uniform float opacity;

#ifdef USE_COLOR
varying vec3 color;
#endif

#include <logdepthbuf_pars_fragment>
void main() {
    #ifdef USE_COLOR
    gl_FragColor = vec4( diffuseColor * vColor, opacity );
    #else
    gl_FragColor = vec4( diffuseColor, opacity );
    #endif
    #include <logdepthbuf_fragment>
}`;

/**
 * HighPrecisionLineMaterial 构造参数
 */
export interface HighPrecisionLineMaterialParameters extends RawShaderMaterialParameters {
    /**
     * 线颜色
     */
    color?: THREE.ColorRepresentation;
    /**
     * 线不透明度
     */
    opacity?: number;
}

/**
 * 用于渲染高精度线的材质（适用于位置敏感数据）
 *
 * 职责：
 * - 提供双精度顶点位置支持
 * - 管理颜色和透明度 uniform
 * - 类型安全的参数处理
 */
export class HighPrecisionLineMaterial extends RawShaderMaterial {
    static readonly DEFAULT_COLOR: number = 0x000050;
    static readonly DEFAULT_OPACITY: number = 1.0;

    /**
     * 类型标记，用于 isHighPrecisionLineMaterial 类型守卫
     */
    isHighPrecisionLineMaterial: boolean;

    /**
     * 构造函数
     *
     * @param params - HighPrecisionLineMaterial 参数，克隆其他材质时可选
     */
    constructor(params?: HighPrecisionLineMaterialParameters) {
        Object.assign(THREE.ShaderChunk, linesShaderChunk);

        const shaderParams: RawShaderMaterialParameters | undefined = params
            ? {
                  name: "HighPrecisionLineMaterial",
                  vertexShader: vertexSource,
                  fragmentShader: fragmentSource,
                  uniforms: {
                      diffuseColor: new THREE.Uniform(
                          new THREE.Color(HighPrecisionLineMaterial.DEFAULT_COLOR)
                      ),
                      opacity: new THREE.Uniform(HighPrecisionLineMaterial.DEFAULT_OPACITY),
                      u_mvp: new THREE.Uniform(new THREE.Matrix4()),
                      u_eyepos: new THREE.Uniform(new THREE.Vector3()),
                      u_eyepos_lowpart: new THREE.Uniform(new THREE.Vector3())
                  },
                  rendererCapabilities: params.rendererCapabilities,
                  ...params
              }
            : undefined;

        super(shaderParams);

        this.isHighPrecisionLineMaterial = true;

        if (params) {
            if (params.color !== undefined) {
                this.color.set(params.color);
            }
            if (params.opacity !== undefined) {
                this.opacity = params.opacity;
            }
        }

        this.updateTransparencyFeature();
    }

    /**
     * 线颜色
     */
    get color(): THREE.Color {
        return this.uniforms.diffuseColor.value as THREE.Color;
    }

    set color(value: THREE.Color) {
        this.uniforms.diffuseColor.value.copy(value);
    }

    /**
     * 更新透明特性
     */
    private updateTransparencyFeature(): void {
        this.transparent = this.opacity < 1.0;
    }
}

/**
 * 类型守卫：检查材质是否为 HighPrecisionLineMaterial
 *
 * @param material - 待检查的材质对象
 * @returns 是否为 HighPrecisionLineMaterial
 */
export function isHighPrecisionLineMaterial(
    material: object | undefined
): material is HighPrecisionLineMaterial {
    return (
        material !== undefined &&
        (material as HighPrecisionLineMaterial).isHighPrecisionLineMaterial === true
    );
}

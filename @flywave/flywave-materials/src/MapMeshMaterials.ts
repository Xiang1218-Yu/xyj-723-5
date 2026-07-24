/* Copyright (C) 2025 flywave.gl contributors */

/**
 * MapMeshMaterials 模块
 *
 * 提供标准的 THREE.js 材质扩展，增加距离淡入淡出（FadingFeature）、
 * 建筑挤出动画（ExtrusionFeature）和位移贴图（DisplacementFeature）功能。
 *
 * 该文件负责应用 mixin（副作用：修改材质原型），实际实现在各独立文件中：
 *
 * - {@link FadingFeature} / {@link FadingFeatureMixin} - 距离淡入淡出
 * - {@link ExtrusionFeature} / {@link ExtrusionFeatureMixin} - 挤出动画
 * - {@link DisplacementFeature} / {@link DisplacementFeatureMixin} - 位移贴图
 * - {@link MapMeshBasicMaterial} - 扩展的 MeshBasicMaterial
 * - {@link MapMeshStandardMaterial} - 扩展的 MeshStandardMaterial
 * - {@link MapMeshDepthMaterial} - 扩展的 MeshDepthMaterial
 */

import { applyMixinsWithoutProperties } from "@flywave/flywave-utils";
import { DisplacementFeatureMixin } from "./DisplacementFeature";
import { ExtrusionFeatureMixin } from "./ExtrusionFeature";
import { FadingFeatureMixin } from "./FadingFeature";
import { MapMeshBasicMaterial } from "./MapMeshBasicMaterial";
import { MapMeshDepthMaterial } from "./MapMeshDepthMaterial";
import { MapMeshStandardMaterial } from "./MapMeshStandardMaterial";

// Apply mixins (side effects)
applyMixinsWithoutProperties(MapMeshBasicMaterial, [FadingFeatureMixin]);
applyMixinsWithoutProperties(MapMeshStandardMaterial, [FadingFeatureMixin]);
applyMixinsWithoutProperties(MapMeshBasicMaterial, [ExtrusionFeatureMixin]);
applyMixinsWithoutProperties(MapMeshStandardMaterial, [ExtrusionFeatureMixin]);
applyMixinsWithoutProperties(MapMeshDepthMaterial, [ExtrusionFeatureMixin]);
applyMixinsWithoutProperties(MapMeshBasicMaterial, [DisplacementFeatureMixin]);

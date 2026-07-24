/* Copyright (C) 2025 flywave.gl contributors */

export { MapDrawControls, DrawEventNames } from "./MapDrawControls";
export { DrawMode } from "./DrawMode";
export { DrawLine } from "./DrawLine";
export { DrawPolygon } from "./DrawPolygon";
export { PointObject, clearPointTextureCache } from "./PointObject";
export { DrawableObject } from "./DrawableObject";
export { GeoJSONDrawControls } from "./GeoJSONDrawControls";
export { MeasureLine } from "./MeasureLine";
export { MeasureToolControls } from "./MeasureToolControls";
export { DrawMaterialFactory } from "./DrawMaterialFactory";
export { HeightHandle } from "./HeightHandle";
export { HeightAdjustManager } from "./HeightAdjustManager";
export { FixedSizeArrow, FixedSizeArrowSystem, type FixedSizeArrowOptions } from "./FixedSizeArrow";

export type {
    DrawableType,
    DrawGeometry,
    DrawPointGeometry,
    DrawLineStringGeometry,
    DrawPolygonGeometry,
    DrawMaterialOptions,
    PointMaterialOptions,
    LineMaterialOptions,
    PolygonMaterialOptions,
    OutlineMaterialOptions,
    VertexPointUserData,
    OutlineUserData,
    ObjectHitResult,
    Object3DWithGeometry,
    CoordinateTuple,
    CoordinateArray
} from "./DrawTypes";

export {
    isObjectWithGeometry,
    isPointGeometry,
    isLineStringGeometry,
    isPolygonGeometry
} from "./DrawTypes";

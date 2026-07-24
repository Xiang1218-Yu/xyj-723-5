/* Copyright (C) 2025 flywave.gl contributors */

import {
    type FeatureGeometry,
    type Point,
    type LineString,
    type Polygon
} from "@flywave/flywave-datasource-protocol";
import * as THREE from "three";

/**
 * 绘制对象类型枚举
 * 定义支持的绘制对象类型
 */
export enum DrawableType {
    /** 点对象 */
    POINT = "point",
    /** 线对象 */
    LINE = "line",
    /** 多边形对象 */
    POLYGON = "polygon",
    /** 测量线对象 */
    MEASURE_LINE = "measure_line"
}

/**
 * 点对象 GeoJSON 几何体（带类型收窄）
 */
export interface DrawPointGeometry extends Point {
    type: "Point";
    coordinates: [number, number] | [number, number, number];
}

/**
 * 线对象 GeoJSON 几何体（带类型收窄）
 */
export interface DrawLineStringGeometry extends LineString {
    type: "LineString";
    coordinates: Array<[number, number] | [number, number, number]>;
}

/**
 * 多边形对象 GeoJSON 几何体（带类型收窄）
 */
export interface DrawPolygonGeometry extends Polygon {
    type: "Polygon";
    coordinates: Array<Array<[number, number] | [number, number, number]>>;
}

/**
 * 绘制对象 GeoJSON 几何体联合类型
 */
export type DrawGeometry = DrawPointGeometry | DrawLineStringGeometry | DrawPolygonGeometry;

/**
 * 材质配置选项接口
 * 定义绘制对象材质的可配置参数
 */
export interface DrawMaterialOptions {
    /** 颜色值 */
    color?: number;
    /** 线宽（仅对线对象有效） */
    lineWidth?: number;
    /** 透明度 */
    opacity?: number;
    /** 是否虚线 */
    dashed?: boolean;
    /** 虚线大小 */
    dashSize?: number;
    /** 虚线间隙大小 */
    gapSize?: number;
    /** 是否透明 */
    transparent?: boolean;
    /** 深度测试 */
    depthTest?: boolean;
    /** 深度写入 */
    depthWrite?: boolean;
    /** 渲染顺序 */
    renderOrder?: number;
}

/**
 * 点材质配置选项
 */
export interface PointMaterialOptions extends DrawMaterialOptions {
    /** 点的大小（像素） */
    size?: number;
    /** 是否为顶点标记 */
    isVertex?: boolean;
}

/**
 * 线材质配置选项
 */
export interface LineMaterialOptions extends DrawMaterialOptions {
    /** 是否使用 alpha 到覆盖率 */
    alphaToCoverage?: boolean;
}

/**
 * 多边形材质配置选项
 */
export interface PolygonMaterialOptions extends DrawMaterialOptions {
    /** 高光颜色 */
    specular?: number;
    /** 高光强度 */
    shininess?: number;
    /** 渲染面 */
    side?: THREE.Side;
}

/**
 * 轮廓材质配置选项
 */
export interface OutlineMaterialOptions extends LineMaterialOptions {
    /** 轮廓颜色 */
    outlineColor?: number;
}

/**
 * 顶点点用户数据接口
 */
export interface VertexPointUserData {
    /** 是否为顶点点 */
    isVertexPoint: true;
    /** 是否为顶点（区别于普通点） */
    isVertex: boolean;
    /** 顶点索引 */
    vertexIndex: number;
    /** 父对象引用 */
    parentObject: import("./DrawableObject").DrawableObject;
}

/**
 * 轮廓对象用户数据接口
 */
export interface OutlineUserData {
    /** 是否为轮廓 */
    isOutline: true;
}

/**
 * 对象命中结果接口
 * 用于射线检测后的结果返回
 */
export interface ObjectHitResult {
    /** 命中的绘制对象 */
    object: import("./DrawableObject").DrawableObject;
    /** 命中的顶点索引（-1 表示命中对象本体） */
    vertexIndex: number;
}

/**
 * 安全类型的 THREE.Object3D，包含可能的几何体和材质
 * 用于替代 any 类型的类型转换
 */
export interface Object3DWithGeometry extends THREE.Object3D {
    geometry?: THREE.BufferGeometry;
    material?: THREE.Material | THREE.Material[];
}

/**
 * 类型守卫：检查对象是否具有 geometry 和 material 属性
 * @param obj - 待检查的 THREE.Object3D 对象
 * @returns 是否为可渲染的网格/线对象
 */
export function isObjectWithGeometry(obj: THREE.Object3D): obj is Object3DWithGeometry {
    return "geometry" in obj && "material" in obj;
}

/**
 * 类型守卫：检查几何体是否为点几何体
 */
export function isPointGeometry(
    geometry: FeatureGeometry
): geometry is DrawPointGeometry {
    return geometry.type === "Point";
}

/**
 * 类型守卫：检查几何体是否为线几何体
 */
export function isLineStringGeometry(
    geometry: FeatureGeometry
): geometry is DrawLineStringGeometry {
    return geometry.type === "LineString";
}

/**
 * 类型守卫：检查几何体是否为多边形几何体
 */
export function isPolygonGeometry(
    geometry: FeatureGeometry
): geometry is DrawPolygonGeometry {
    return geometry.type === "Polygon";
}

/**
 * 坐标数组类型
 * 支持二维和三维坐标
 */
export type CoordinateTuple = [number, number] | [number, number, number];

/**
 * 坐标数组集合类型
 */
export type CoordinateArray = CoordinateTuple[];

/**
 * 从坐标数组创建 GeoCoordinates 数组的工具函数类型
 */
export type CoordinateConverter = (coords: CoordinateArray) => import("@flywave/flywave-geoutils").GeoCoordinates[];

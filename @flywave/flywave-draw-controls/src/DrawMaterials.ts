/* Copyright (C) 2025 flywave.gl contributors */

import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";

/**
 * Configuration for a line material produced by {@link DrawMaterialFactory.createLineMaterial}.
 *
 * @remarks
 * Groups the handful of parameters shared between the main line, outline line
 * and edge lines of {@link DrawLine} / {@link DrawPolygon}.
 */
export interface LineMaterialConfig {
    /** Line color as a hex number (e.g. `0xffff00`). */
    color: number;
    /** Line width in pixels (for `LineMaterial`). */
    linewidth: number;
    /** Whether the line should be dashed. */
    dashed?: boolean;
    /** Dash size when {@link dashed} is `true`. */
    dashSize?: number;
    /** Gap size between dashes when {@link dashed} is `true`. */
    gapSize?: number;
    /** Opacity (0-1). */
    opacity?: number;
    /** Enable depth test (default `false` to keep draw objects on top). */
    depthTest?: boolean;
    /** Enable depth write (default `false`). */
    depthWrite?: boolean;
    /** Enable alpha-to-coverage anti-aliasing. */
    alphaToCoverage?: boolean;
}

/**
 * Configuration for the polygon fill material produced by
 * {@link DrawMaterialFactory.createPolygonMaterial}.
 */
export interface PolygonMaterialConfig {
    /** Fill color as a hex number. */
    color: number;
    /** Fill opacity (0-1). */
    opacity: number;
    /** Specular color used by `MeshPhongMaterial`. */
    specular?: number;
    /** Shininess exponent. */
    shininess?: number;
}

/**
 * Configuration for the point/sprite material produced by
 * {@link DrawMaterialFactory.createSpriteMaterial}.
 */
export interface SpriteMaterialConfig {
    /** Texture used as the sprite map. */
    map: THREE.Texture;
}

/**
 * Configuration for the selection ring (halo) material used by {@link PointObject}.
 */
export interface RingMaterialConfig {
    /** Ring color as a hex number. */
    color: number;
    /** Initial opacity (usually 0 until selected). */
    opacity: number;
}

/**
 * Central factory for all materials used by the draw-controls objects.
 *
 * @remarks
 * Previously, material creation was scattered across `DrawLine`, `DrawPolygon` and
 * `PointObject` (e.g. inline `new LineMaterial(...)` in constructors). This factory
 * follows the **single responsibility principle**:
 * - Draw objects describe *what* they need (via the config interfaces).
 * - The factory decides *how* to instantiate and configure the THREE.js materials.
 *
 * The factory is stateless; a single shared instance ({@link drawMaterialFactory})
 * is exported for convenience but callers may also construct their own.
 */
export class DrawMaterialFactory {
    /**
     * Create a `LineMaterial` from the given configuration.
     *
     * @param config - Material parameters.
     * @returns Configured `LineMaterial` instance.
     */
    createLineMaterial(config: LineMaterialConfig): LineMaterial {
        return new LineMaterial({
            color: config.color,
            linewidth: config.linewidth,
            dashed: config.dashed ?? false,
            dashSize: config.dashSize,
            gapSize: config.gapSize,
            opacity: config.opacity ?? 1.0,
            depthTest: config.depthTest ?? false,
            depthWrite: config.depthWrite ?? false,
            transparent: true,
            alphaToCoverage: config.alphaToCoverage ?? false
        });
    }

    /**
     * Create the default main line material for {@link DrawLine}.
     *
     * @param color - Line color.
     * @param linewidth - Line width in pixels.
     */
    createMainLineMaterial(color: number, linewidth: number): LineMaterial {
        return this.createLineMaterial({
            color,
            linewidth,
            depthTest: false,
            transparent: true,
            alphaToCoverage: true,
            opacity: 1.0
        } as LineMaterialConfig);
    }

    /**
     * Create the outline (dashed halo) line material for {@link DrawLine}.
     */
    createOutlineLineMaterial(): LineMaterial {
        return this.createLineMaterial({
            color: 0xffd700,
            linewidth: 3,
            dashed: true,
            dashSize: 0.8,
            gapSize: 0.4,
            depthTest: false,
            depthWrite: false,
            opacity: 0.8
        });
    }

    /**
     * Create a single edge line material used by {@link DrawPolygon} to render
     * the polygon's edges individually.
     */
    createEdgeLineMaterial(): LineMaterial {
        return this.createLineMaterial({
            color: 0x888888,
            linewidth: 1,
            depthTest: false,
            depthWrite: false,
            opacity: 1.0
        });
    }

    /**
     * Create the outline-edge (selected state) material for {@link DrawPolygon}.
     */
    createOutlineEdgeMaterial(): LineMaterial {
        return this.createLineMaterial({
            color: 0xffd700,
            linewidth: 2,
            dashed: true,
            dashSize: 0.6,
            gapSize: 0.3,
            depthTest: false,
            depthWrite: false,
            opacity: 0.8
        });
    }

    /**
     * Create a `MeshPhongMaterial` for polygon fills.
     *
     * @param config - Fill parameters.
     */
    createPolygonMaterial(config: PolygonMaterialConfig): THREE.MeshPhongMaterial {
        return new THREE.MeshPhongMaterial({
            color: config.color,
            opacity: config.opacity,
            transparent: true,
            side: THREE.DoubleSide,
            specular: config.specular ?? 0x111111,
            shininess: config.shininess ?? 30
        });
    }

    /**
     * Create a `SpriteMaterial` for point objects.
     *
     * @param config - Sprite parameters (texture map).
     */
    createSpriteMaterial(config: SpriteMaterialConfig): THREE.SpriteMaterial {
        return new THREE.SpriteMaterial({
            map: config.map,
            color: 0xffffff,
            transparent: true,
            opacity: 1.0,
            sizeAttenuation: false,
            depthTest: false,
            depthWrite: false
        });
    }

    /**
     * Create a `MeshBasicMaterial` for the selection ring around a point.
     *
     * @param config - Ring parameters.
     */
    createRingMaterial(config: RingMaterialConfig): THREE.MeshBasicMaterial {
        return new THREE.MeshBasicMaterial({
            color: config.color,
            transparent: true,
            opacity: config.opacity,
            side: THREE.DoubleSide,
            depthTest: false
        });
    }
}

/** Shared singleton instance used by draw objects unless overridden. */
export const drawMaterialFactory = new DrawMaterialFactory();

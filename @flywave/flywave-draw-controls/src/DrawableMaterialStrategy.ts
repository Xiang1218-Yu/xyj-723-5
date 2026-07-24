/* Copyright (C) 2025 flywave.gl contributors */

import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";

/**
 * Material strategy abstraction for the {@link DrawableObject} hierarchy.
 *
 * @remarks
 * Previously every drawable (`DrawLine`, `DrawPolygon`, `PointObject`, ...) hard-coded the creation
 * of its THREE materials inside `protected createXMaterial()` methods, mixing "what to draw" with
 * "how it looks". This interface extracts the appearance concern into an injectable strategy
 * (Strategy pattern), so material styling can be swapped or themed without subclassing the drawable
 * objects, while the drawables keep their single responsibility of geometry/interaction management.
 *
 * Concrete drawables call the strategy to obtain their materials. The default implementation
 * {@link DefaultDrawableMaterialStrategy} reproduces the original look, so existing behaviour is
 * preserved when no custom strategy is supplied.
 */
export interface DrawableMaterialStrategy {
    /**
     * Create the main material for a poly-line body.
     * @param color - Line color (hex number).
     * @param lineWidth - Line width in world units.
     */
    createLineMaterial(color: number, lineWidth: number): LineMaterial;

    /**
     * Create the dashed "selected/outline" material rendered behind a line body.
     */
    createLineOutlineMaterial(): LineMaterial;

    /**
     * Create the filled surface material of a polygon.
     * @param color - Fill color (hex number).
     * @param opacity - Fill opacity in the range `[0, 1]`.
     */
    createPolygonFillMaterial(color: number, opacity: number): THREE.MeshPhongMaterial;

    /**
     * Create the solid boundary (outline) material of a polygon.
     * @param color - Outline color (hex number).
     */
    createPolygonOutlineMaterial(color: number): LineMaterial;

    /**
     * Create the material used for the individual edges of a polygon.
     */
    createPolygonEdgeMaterial(): LineMaterial;

    /**
     * Create the dashed material used for the highlighted outline edges of a polygon.
     */
    createPolygonOutlineEdgeMaterial(): LineMaterial;

    /**
     * Create the sprite material used to render a point marker.
     * @param map - The pre-rendered point texture used as the sprite map.
     */
    createPointSpriteMaterial(map: THREE.Texture): THREE.SpriteMaterial;
}

/**
 * Default {@link DrawableMaterialStrategy} implementation reproducing the engine's built-in look.
 *
 * The values here are the exact parameters previously inlined in the drawable classes, so swapping
 * in this strategy is behaviour-preserving.
 */
export class DefaultDrawableMaterialStrategy implements DrawableMaterialStrategy {
    createLineMaterial(color: number, lineWidth: number): LineMaterial {
        return new LineMaterial({
            color,
            linewidth: lineWidth,
            dashed: false,
            opacity: 1.0,
            depthTest: false,
            transparent: true,
            alphaToCoverage: true
        });
    }

    createLineOutlineMaterial(): LineMaterial {
        return new LineMaterial({
            color: 0xffd700,
            linewidth: 3,
            dashed: true,
            dashSize: 0.8,
            gapSize: 0.4,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            opacity: 0.8
        });
    }

    createPolygonFillMaterial(color: number, opacity: number): THREE.MeshPhongMaterial {
        return new THREE.MeshPhongMaterial({
            color,
            opacity,
            transparent: true,
            side: THREE.DoubleSide,
            specular: 0x111111,
            shininess: 30
        });
    }

    createPolygonOutlineMaterial(color: number): LineMaterial {
        return new LineMaterial({
            color,
            linewidth: 3,
            dashed: false,
            opacity: 1.0,
            transparent: true
        });
    }

    createPolygonEdgeMaterial(): LineMaterial {
        return new LineMaterial({
            color: 0x888888,
            linewidth: 1,
            dashed: false,
            opacity: 1.0,
            transparent: true
        });
    }

    createPolygonOutlineEdgeMaterial(): LineMaterial {
        return new LineMaterial({
            color: 0xffd700,
            linewidth: 2,
            dashed: true,
            dashSize: 0.6,
            gapSize: 0.3,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            opacity: 0.8
        });
    }

    createPointSpriteMaterial(map: THREE.Texture): THREE.SpriteMaterial {
        return new THREE.SpriteMaterial({
            map,
            color: 0xffffff,
            transparent: true,
            opacity: 1.0,
            sizeAttenuation: false,
            depthTest: false,
            depthWrite: false
        });
    }
}

/**
 * Shared default strategy instance used by drawable objects when no custom strategy is injected.
 * Materials are always constructed fresh per call, so sharing a single stateless strategy is safe.
 */
export const defaultDrawableMaterialStrategy: DrawableMaterialStrategy =
    new DefaultDrawableMaterialStrategy();

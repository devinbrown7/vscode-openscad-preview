import {
  Camera,
  Color,
  Group,
  Intersection,
  Loader,
  Material,
  Mesh,
  Raycaster,
  Scene,
  Vector2,
} from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { Tool, ViewportBindings } from "./Tool";

export interface SelectToolContext {
  raycaster: Raycaster;
  camera: () => Camera;
  modelGroup: Group;
  scene: Scene;
  color: Color;
}

/** A named material under the pointer: the object it's on, and its name. */
export interface HoveredMaterial {
  object: string;
  material: string;
}

/** How far the hovered material's color moves toward the accent. */
const HIGHLIGHT = 0.5;

/**
 * Selects scene objects (Stage handles the clicks). While the pointer is
 * still over the model, it names the 3MF material under it, as with face
 * or color names, and tints that material's triangles toward the accent color.
 */
export class SelectTool implements Tool {
  readonly gizmoMode = null;
  readonly capturesClick = false;

  private canvas: HTMLElement | null = null;
  private label: CSS2DObject;
  private hovered: { mesh: Mesh; color: Color } | null = null;

  constructor(private ctx: SelectToolContext) {
    const el = document.createElement("div");
    el.style.cssText = `
      padding: 2px 6px;
      background: rgba(0, 0, 0, 0.65);
      color: white;
      font-size: 11px;
      font-family: monospace;
      border-radius: 3px;
      margin-top: -16px;
      white-space: nowrap;
      pointer-events: none;
    `;
    this.label = new CSS2DObject(el);
    // The renderer sets the transform, so anchor the bottom center at the
    // pointer and lift it with a margin, clear of the cursor.
    this.label.center.set(0.5, 1);
    this.label.visible = false;
  }

  activate(bindings: ViewportBindings): void {
    this.canvas = bindings.canvas;
    this.canvas.addEventListener("pointermove", this.handleMove);
    this.canvas.addEventListener("pointerleave", this.clear);
    this.canvas.addEventListener("pointerdown", this.clear);
    this.ctx.scene.add(this.label);
  }

  deactivate(): void {
    this.canvas?.removeEventListener("pointermove", this.handleMove);
    this.canvas?.removeEventListener("pointerleave", this.clear);
    this.canvas?.removeEventListener("pointerdown", this.clear);
    this.canvas = null;
    this.clear();
    this.ctx.scene.remove(this.label);
    this.label.element.remove();
  }

  /** The named material under the pointer, if any. */
  public get hoveredMaterial(): HoveredMaterial | null {
    if (!this.hovered) return null;
    const { mesh } = this.hovered;
    return { object: mesh.name, material: materialOf(mesh).name };
  }

  private handleMove = (e: PointerEvent) => {
    // A drag orbits the camera; leave the model alone until it stops.
    if (e.buttons !== 0 || !this.canvas) {
      this.clear();
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.ctx.raycaster.setFromCamera(pointer, this.ctx.camera());
    const hit = this.ctx.raycaster
      .intersectObject(this.ctx.modelGroup, true)
      .find(isVisible);
    const mesh = hit?.object instanceof Mesh ? hit.object : null;
    if (!hit || !mesh || !isNamed(materialOf(mesh))) {
      this.clear();
      return;
    }
    if (this.hovered?.mesh !== mesh) {
      this.clear();
      this.highlight(mesh);
    }
    this.label.element.textContent = materialOf(mesh).name;
    this.label.position.copy(hit.point);
    this.label.visible = true;
  };

  private highlight(mesh: Mesh) {
    // The 3MF loader shares one material between every object that uses
    // it, so give this mesh its own before tinting it. The clipping planes
    // stay the live ones, so cross-sections keep cutting it.
    if (!mesh.userData.ownMaterial) {
      const shared = materialOf(mesh);
      const own = shared.clone();
      own.clippingPlanes = shared.clippingPlanes;
      mesh.material = own;
      mesh.userData.ownMaterial = true;
    }
    const color = colorOf(materialOf(mesh));
    if (!color) return;
    this.hovered = { mesh, color: color.clone() };
    color.lerp(this.ctx.color, HIGHLIGHT);
  }

  private clear = () => {
    this.label.visible = false;
    if (!this.hovered) return;
    colorOf(materialOf(this.hovered.mesh))?.copy(this.hovered.color);
    this.hovered = null;
  };
}

function materialOf(mesh: Mesh): Material {
  return Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
}

function colorOf(material: Material): Color | null {
  return "color" in material && material.color instanceof Color
    ? material.color
    : null;
}

/** A material named in the file, not the loader's default. */
function isNamed(material: Material): boolean {
  return material.name !== "" && material.name !== Loader.DEFAULT_MATERIAL_NAME;
}

/** Whether a hit is on a part of the model no cross-section cuts away. */
function isVisible(hit: Intersection): boolean {
  if (!(hit.object instanceof Mesh)) return false;
  const planes = materialOf(hit.object).clippingPlanes ?? [];
  return planes.every((p) => p.distanceToPoint(hit.point) >= 0);
}

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
  Vector3,
} from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import "../../components/atoms/MaterialLabel";
import type { MaterialLabel } from "../../components/atoms/MaterialLabel";
import { TintTracker } from "../utilities/TintTracker";
import { Tool, ViewportBindings } from "./Tool";

export interface SelectToolContext {
  raycaster: Raycaster;
  camera: () => Camera;
  modelGroup: Group;
  scene: Scene;
  color: Color;
  /** Ctrl+click (Cmd+click on macOS) on a named material. */
  openMaterial: (material: HoveredMaterial) => void;
  /** Copies a material's name to the clipboard. */
  copyText: (text: string) => void;
  /** Draws a frame, after a change the canvas doesn't see. */
  requestRender?: () => void;
}

/** A named material under the pointer: the object it's on, and its name. */
export interface HoveredMaterial {
  object: string;
  material: string;
}

/** How far a highlighted material's color moves toward the accent. */
const HIGHLIGHT = 0.5;

/** The most a pointer may move between down and up to count as a click. */
const CLICK_SLOP = 4;

/** How long the pinned label says "copied". */
const COPIED_MS = 1000;

/**
 * Selects scene objects (Stage handles the clicks). While the pointer is
 * still over the model, it names the 3MF material under it, as with face
 * or color names, and tints that material's triangles toward the accent color.
 * A click pins that material: it stays tinted and labeled, with buttons to
 * copy its name and to dismiss it, until another click or a reset.
 */
export class SelectTool implements Tool {
  readonly gizmoMode = null;
  readonly capturesClick = false;

  private canvas: HTMLElement | null = null;
  private label: CSS2DObject;
  private pinLabel: CSS2DObject;
  private hovered: { mesh: Mesh; point: Vector3 } | null = null;
  private pinned: Mesh | null = null;
  private tints = new TintTracker<Mesh>();
  private originals = new Map<Mesh, Color>();
  /** Where a plain left press began, and what was under it. */
  private press: { x: number; y: number } | null = null;
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private ctx: SelectToolContext) {
    const el = document.createElement("scad-material-label");
    this.label = new CSS2DObject(el);
    // The renderer sets the transform, so anchor the bottom center at the
    // pointer and lift it 7px with a margin, so its bottom edge clears the
    // tip of the cursor arrow.
    this.label.center.set(0.5, 1);
    this.label.visible = false;

    const pinEl = document.createElement("scad-material-label");
    pinEl.pinned = true;
    pinEl.addEventListener("copy", this.copyPinned);
    pinEl.addEventListener("dismiss", this.dismissPinned);
    this.pinLabel = new CSS2DObject(pinEl);
    this.pinLabel.center.set(0.5, 1);
    this.pinLabel.visible = false;
  }

  activate(bindings: ViewportBindings): void {
    this.canvas = bindings.canvas;
    this.canvas.addEventListener("pointermove", this.handleMove);
    this.canvas.addEventListener("pointerleave", this.clear);
    this.canvas.addEventListener("pointerdown", this.handleDown);
    this.canvas.addEventListener("pointerup", this.handleUp);
    this.ctx.scene.add(this.label);
    this.ctx.scene.add(this.pinLabel);
  }

  deactivate(): void {
    this.canvas?.removeEventListener("pointermove", this.handleMove);
    this.canvas?.removeEventListener("pointerleave", this.clear);
    this.canvas?.removeEventListener("pointerdown", this.handleDown);
    this.canvas?.removeEventListener("pointerup", this.handleUp);
    this.canvas = null;
    this.reset();
    this.ctx.scene.remove(this.label);
    this.ctx.scene.remove(this.pinLabel);
    this.label.element.remove();
    this.pinLabel.element.remove();
  }

  /** Drops the hover and the pin, as when the model is replaced. */
  reset(): void {
    this.hovered = null;
    this.pinned = null;
    this.press = null;
    this.stopCopied();
    this.label.visible = false;
    this.pinLabel.visible = false;
    for (const mesh of this.tints.reset()) this.untint(mesh);
  }

  /** The named material under the pointer, if any. */
  public get hoveredMaterial(): HoveredMaterial | null {
    return this.hovered ? describe(this.hovered.mesh) : null;
  }

  private handleMove = (e: PointerEvent) => {
    // A drag orbits the camera; leave the model alone until it stops.
    if (e.buttons !== 0 || !this.canvas) {
      this.clear();
      return;
    }
    const target = this.pick(e);
    if (!target) {
      this.clear();
      return;
    }
    const { mesh, point } = target;
    this.hovered = target;
    this.syncTints();
    // The pinned label already names the pinned material.
    const showLabel = mesh !== this.pinned;
    this.label.visible = showLabel;
    if (showLabel) {
      this.nameLabel(this.label, mesh);
      this.label.position.copy(point);
    }
  };

  /** The named mesh under the pointer, and where the ray hit it. */
  private pick(e: PointerEvent): HoveredHit | null {
    if (!this.canvas) return null;
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
    if (!hit || !mesh || !isNamed(materialOf(mesh))) return null;
    return { mesh, point: hit.point.clone() };
  }

  private handleDown = (e: PointerEvent) => {
    this.press = null;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey) {
      const target = this.pick(e);
      this.clear();
      if (target) this.ctx.openMaterial(describe(target.mesh));
      return;
    }
    // Pinning waits for the pointer to come up in place: a drag orbits.
    this.press = { x: e.clientX, y: e.clientY };
  };

  private handleUp = (e: PointerEvent) => {
    const press = this.press;
    this.press = null;
    if (!press || e.button !== 0) return;
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_SLOP)
      return;
    this.pin(this.pick(e));
    this.ctx.requestRender?.();
  };

  private pin(target: HoveredHit | null) {
    this.stopCopied();
    this.pinned = target?.mesh ?? null;
    this.pinLabel.visible = target !== null;
    if (target) {
      this.nameLabel(this.pinLabel, target.mesh);
      this.pinLabel.position.copy(target.point);
    }
    this.syncTints();
  }

  private nameLabel(label: CSS2DObject, mesh: Mesh) {
    (label.element as MaterialLabel).name = materialOf(mesh).name;
  }

  private copyPinned = () => {
    if (!this.pinned) return;
    this.ctx.copyText(materialOf(this.pinned).name);
    const el = this.pinLabel.element as MaterialLabel;
    el.copied = true;
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => {
      this.stopCopied();
      this.ctx.requestRender?.();
    }, COPIED_MS);
    this.ctx.requestRender?.();
  };

  private dismissPinned = () => {
    this.pin(null);
    this.ctx.requestRender?.();
  };

  private stopCopied() {
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
    this.copiedTimer = null;
    (this.pinLabel.element as MaterialLabel).copied = false;
  }

  /** Tints the hovered and the pinned mesh, and puts the rest back. */
  private syncTints() {
    const { tint, untint } = this.tints.update(
      this.hovered?.mesh ?? null,
      this.pinned,
    );
    untint.forEach((mesh) => this.untint(mesh));
    tint.forEach((mesh) => this.tint(mesh));
  }

  private tint(mesh: Mesh) {
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
    this.originals.set(mesh, color.clone());
    color.lerp(this.ctx.color, HIGHLIGHT);
  }

  private untint(mesh: Mesh) {
    const original = this.originals.get(mesh);
    if (original) colorOf(materialOf(mesh))?.copy(original);
    this.originals.delete(mesh);
  }

  /** Ends the hover; the pin stays. */
  private clear = () => {
    this.label.visible = false;
    if (!this.hovered) return;
    this.hovered = null;
    this.syncTints();
  };
}

/** What the pointer was on: the mesh, and the point it hit. */
interface HoveredHit {
  mesh: Mesh;
  point: Vector3;
}

function describe(mesh: Mesh): HoveredMaterial {
  return { object: mesh.name, material: materialOf(mesh).name };
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

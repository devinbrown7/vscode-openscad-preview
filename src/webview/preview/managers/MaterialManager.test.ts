import test from "node:test";
import assert from "node:assert";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import {
  Environment,
  CameraMode,
  RenderMode,
  ViewOptions,
  ViewOptionsContext,
} from "../../contexts/ViewOptionsContext";
import { MaterialManager } from "./MaterialManager";

function settings(changes: Partial<ViewOptions>): ViewOptionsContext {
  const options: ViewOptions = {
    environment: Environment.None,
    renderMode: RenderMode.Solid,
    camera: CameraMode.Perspective,
    shadows: false,
    smoothShading: true,
    fogDensity: 0,
    ...changes,
  };
  return {
    options,
    get: (key) => options[key],
    is: (key, value) => options[key] === value,
    set: (key, value) => {
      options[key] = value;
    },
  };
}

function flatShadingAfter(changes: Partial<ViewOptions>): boolean {
  const material = new MeshStandardMaterial();
  const group = new Group();
  group.add(new Mesh(new BoxGeometry(), material));
  new MaterialManager().applyToGroup(group, settings(changes));
  return material.flatShading;
}

test("MaterialManager - smooth shading on leaves materials smooth", () => {
  assert.strictEqual(flatShadingAfter({ smoothShading: true }), false);
});

test("MaterialManager - smooth shading off shades flat", () => {
  assert.strictEqual(flatShadingAfter({ smoothShading: false }), true);
});

test("MaterialManager - wireframe shades smooth either way", () => {
  assert.strictEqual(
    flatShadingAfter({
      smoothShading: false,
      renderMode: RenderMode.Wireframe,
    }),
    false,
  );
});

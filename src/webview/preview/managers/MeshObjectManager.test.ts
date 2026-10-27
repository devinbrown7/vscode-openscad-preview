import test from "node:test";
import assert from "node:assert";
import { Color, Group, Mesh, MeshPhongMaterial } from "three";
import { MeshGeometry } from "../../../shared/types/MeshGeometry";
import { MeshObjectManager } from "./MeshObjectManager";

/** Two triangles of a unit square at z = 0, one per material. */
function square(): MeshGeometry {
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    materials: ["top", "lid"],
    triangleMaterials: new Uint32Array([0, 1]),
  };
}

function meshes(object: unknown): Mesh[] {
  assert.ok(object instanceof Group);
  return object.children.filter((c): c is Mesh => c instanceof Mesh);
}

const gray = new Color(0.5, 0.5, 0.5);

test("MeshObjectManager - a group per object, a mesh per material", () => {
  const manager = new MeshObjectManager();
  const [object] = manager.load(
    [
      {
        key: "a",
        name: "Plate",
        color: "#FF000080",
        position: [1, 2, 3],
        geometry: square(),
      },
    ],
    gray,
  );
  assert.strictEqual(object.name, "Plate");
  assert.deepStrictEqual(object.position.toArray(), [1, 2, 3]);
  const [top, lid] = meshes(object);
  assert.strictEqual(top.name, "Plate");
  const material = top.material as MeshPhongMaterial;
  assert.strictEqual(material.name, "top");
  assert.strictEqual((lid.material as MeshPhongMaterial).name, "lid");
  assert.strictEqual(material.color.getHexString(), "ff0000");
  assert.ok(
    material.transparent && Math.abs(material.opacity - 128 / 255) < 1e-9,
  );
  // Flat normals, one triangle per material, no index.
  assert.strictEqual(top.geometry.index, null);
  assert.deepStrictEqual(
    Array.from(top.geometry.getAttribute("normal").array),
    [0, 0, 1, 0, 0, 1, 0, 0, 1],
  );
});

test("MeshObjectManager - keeps the geometry of keys it has, frees the rest", () => {
  const manager = new MeshObjectManager();
  const object = (key: string, withGeometry: boolean) => ({
    key,
    name: key,
    position: [0, 0, 0] as [number, number, number],
    geometry: withGeometry ? square() : undefined,
  });
  const [a] = manager.load([object("a", true), object("b", true)], gray);
  const kept = meshes(a)[0].geometry;
  const [, b] = manager.load([object("a", false), object("b", false)], gray);
  let freed = 0;
  for (const m of meshes(b)) {
    m.geometry.addEventListener("dispose", () => freed++);
  }

  // `a` comes without its geometry and reuses it; `b` is gone.
  const [again] = manager.load([object("a", false)], gray);
  assert.strictEqual(meshes(again)[0].geometry, kept);
  assert.strictEqual(freed, 2);
  // Without a color, the object takes the one given.
  const material = meshes(again)[0].material as MeshPhongMaterial;
  assert.ok(material.color.equals(gray));

  // A key it never had, without geometry, is skipped.
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.strictEqual(manager.load([object("c", false)], gray).length, 0);
  } finally {
    console.error = originalError;
  }
});

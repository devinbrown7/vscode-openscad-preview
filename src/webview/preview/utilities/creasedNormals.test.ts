import test from "node:test";
import assert from "node:assert";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { applyCreasedNormals, creasedNormals } from "./creasedNormals";

/** A unit cube with 8 shared vertices and 12 triangles, facing outward. */
function cube() {
  const positions = new Float32Array([
    0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1,
  ]);
  const indices = new Uint32Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 0,
    4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
  ]);
  return { positions, indices };
}

/** A tube along z with `sides` sides: a smooth wall with no caps. */
function tube(sides: number) {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * 2 * Math.PI;
    positions.push(Math.cos(a), Math.sin(a), 0, Math.cos(a), Math.sin(a), 1);
  }
  for (let i = 0; i < sides; i++) {
    const b0 = i * 2;
    const t0 = b0 + 1;
    const b1 = ((i + 1) % sides) * 2;
    const t1 = b1 + 1;
    indices.push(b0, b1, t1, b0, t1, t0);
  }
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}

test("creasedNormals - a cube keeps its edges sharp", () => {
  const { positions, indices } = cube();
  const normals = creasedNormals(positions, indices);
  for (let t = 0; t < 12; t++) {
    const first = normals.slice(t * 9, t * 9 + 3);
    for (let k = 1; k < 3; k++) {
      assert.deepStrictEqual(
        normals.slice(t * 9 + k * 3, t * 9 + k * 3 + 3),
        first,
      );
    }
    // Axis aligned: one component is +-1.
    assert.ok(Math.abs(Math.max(...first.map(Math.abs)) - 1) < 1e-6);
  }
});

test("creasedNormals - a fine tube shades smooth", () => {
  const { positions, indices } = tube(32);
  const normals = creasedNormals(positions, indices);
  for (let c = 0; c < indices.length; c++) {
    const v = indices[c] * 3;
    // The normal points straight out from the axis at its vertex.
    assert.ok(Math.abs(normals[c * 3] - positions[v]) < 1e-5);
    assert.ok(Math.abs(normals[c * 3 + 1] - positions[v + 1]) < 1e-5);
    assert.ok(Math.abs(normals[c * 3 + 2]) < 1e-5);
  }
});

test("creasedNormals - a coarse tube keeps its sides flat", () => {
  // 6 sides bend 60 degrees at each edge, past the 30 degree crease.
  const { positions, indices } = tube(6);
  const normals = creasedNormals(positions, indices);
  for (let t = 0; t < 12; t++) {
    const first = normals.slice(t * 9, t * 9 + 3);
    assert.deepStrictEqual(normals.slice(t * 9 + 3, t * 9 + 6), first);
  }
});

test("creasedNormals - split vertices at one position still smooth", () => {
  const { positions, indices } = tube(32);
  // Unindexed copy: every triangle has its own vertices.
  const flat = new Float32Array(indices.length * 3);
  indices.forEach((v, c) =>
    flat.set(positions.subarray(v * 3, v * 3 + 3), c * 3),
  );
  const normals = creasedNormals(flat, null);
  const welded = creasedNormals(positions, indices);
  assert.deepStrictEqual(normals, welded);
});

test("applyCreasedNormals - unindexes and sets normals", () => {
  const { positions, indices } = cube();
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(Array.from(indices));
  const result = applyCreasedNormals(geometry);
  assert.strictEqual(result.index, null);
  assert.strictEqual(result.getAttribute("normal").count, 36);
});

/** Two unit squares sharing an edge, the second bent up by `degrees`. */
function fold(degrees: number) {
  const r = (degrees * Math.PI) / 180;
  const positions = new Float32Array([
    0,
    0,
    0,
    1,
    0,
    0,
    1,
    1,
    0,
    0,
    1,
    0,
    1 + Math.cos(r),
    0,
    Math.sin(r),
    1 + Math.cos(r),
    1,
    Math.sin(r),
  ]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3, 1, 4, 5, 1, 5, 2]);
  return { positions, indices };
}

test("creasedNormals - an edge just under the crease angle smooths", () => {
  const { positions, indices } = fold(19);
  const normals = creasedNormals(positions, indices);
  // Corner 0 of the first triangle sits off the edge; corner 1 sits on it.
  assert.ok(normals[2] > 0.999999);
  assert.ok(normals[3 + 2] < 0.999);
});

test("creasedNormals - an edge just over the crease angle stays sharp", () => {
  const { positions, indices } = fold(21);
  const normals = creasedNormals(positions, indices);
  assert.ok(normals[3 + 2] > 0.999999);
});

test("creasedNormals - degenerate triangles give finite normals", () => {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 0]);
  const normals = creasedNormals(
    positions,
    new Uint32Array([0, 1, 2, 0, 0, 3]),
  );
  for (const n of normals) assert.ok(Number.isFinite(n));
});

import { BufferAttribute, BufferGeometry } from "three";

/**
 * Surfaces that bend by less than this look smooth; sharper ones stay sharp.
 * A larger angle smooths coarser curves, but also spreads the shading of a
 * gentle fillet or chamfer into the flat face beside it, so it is kept small.
 */
export const DEFAULT_CREASE_ANGLE = (20 * Math.PI) / 180;

/**
 * Gives every vertex of every triangle a normal that averages the faces
 * around it that bend away by no more than the crease angle. Curves shade
 * smooth and sharp edges stay sharp.
 *
 * `positions` holds xyz per vertex. `indices` lists the triangles' vertices,
 * or is null when every three vertices make a triangle. Vertices at the same
 * position share their faces, whether or not they share an index. The result
 * holds three normals per triangle, in the order of the triangle corners.
 * Cost is linear in the triangle count, and a little higher for an unindexed
 * mesh (an STL or a 3MF), which has three times the vertices to weld: about
 * 0.4 s for a million indexed triangles and 0.55 s unindexed. It runs on the
 * main thread.
 */
export function creasedNormals(
  positions: ArrayLike<number>,
  indices: ArrayLike<number> | null,
  creaseAngle: number = DEFAULT_CREASE_ANGLE,
): Float32Array {
  const corners = indices ? indices.length : Math.floor(positions.length / 3);
  const triangles = Math.floor(corners / 3);
  const corner = (c: number) => (indices ? indices[c] : c);
  const weld = weldVertices(positions);
  const vertexCount = Math.floor(positions.length / 3);

  // Unit face normals, and the angle of each triangle at each corner.
  const face = new Float32Array(triangles * 3);
  const angle = new Float32Array(triangles * 3);
  for (let t = 0; t < triangles; t++) {
    const a = corner(t * 3) * 3;
    const b = corner(t * 3 + 1) * 3;
    const c = corner(t * 3 + 2) * 3;
    const abx = positions[b] - positions[a];
    const aby = positions[b + 1] - positions[a + 1];
    const abz = positions[b + 2] - positions[a + 2];
    const acx = positions[c] - positions[a];
    const acy = positions[c + 1] - positions[a + 1];
    const acz = positions[c + 2] - positions[a + 2];
    const bcx = positions[c] - positions[b];
    const bcy = positions[c + 1] - positions[b + 1];
    const bcz = positions[c + 2] - positions[b + 2];
    let nx = aby * acz - abz * acy;
    let ny = abz * acx - abx * acz;
    let nz = abx * acy - aby * acx;
    const length = Math.hypot(nx, ny, nz);
    if (length > 0) {
      nx /= length;
      ny /= length;
      nz /= length;
    }
    face[t * 3] = nx;
    face[t * 3 + 1] = ny;
    face[t * 3 + 2] = nz;
    // Angles at a, b and c, so a fan of thin triangles does not outweigh a
    // single wide one.
    const la = Math.hypot(abx, aby, abz);
    const lb = Math.hypot(bcx, bcy, bcz);
    const lc = Math.hypot(acx, acy, acz);
    angle[t * 3] = cornerAngle(abx * acx + aby * acy + abz * acz, la * lc);
    angle[t * 3 + 1] = cornerAngle(
      -(abx * bcx + aby * bcy + abz * bcz),
      la * lb,
    );
    angle[t * 3 + 2] = cornerAngle(acx * bcx + acy * bcy + acz * bcz, lc * lb);
  }

  // The corners around each welded vertex, as a compressed list.
  const start = new Uint32Array(vertexCount + 1);
  for (let c = 0; c < triangles * 3; c++) start[weld[corner(c)] + 1]++;
  for (let v = 0; v < vertexCount; v++) start[v + 1] += start[v];
  const fill = start.slice(0, vertexCount);
  const around = new Uint32Array(triangles * 3);
  for (let c = 0; c < triangles * 3; c++) around[fill[weld[corner(c)]]++] = c;

  const creaseDot = Math.cos(creaseAngle);
  const normals = new Float32Array(triangles * 9);
  for (let c = 0; c < triangles * 3; c++) {
    const t = (c / 3) | 0;
    const fx = face[t * 3];
    const fy = face[t * 3 + 1];
    const fz = face[t * 3 + 2];
    const v = weld[corner(c)];
    let x = 0;
    let y = 0;
    let z = 0;
    for (let i = start[v]; i < start[v + 1]; i++) {
      const o = around[i];
      const u = ((o / 3) | 0) * 3;
      // A degenerate face has a zero normal, so it never passes.
      if (fx * face[u] + fy * face[u + 1] + fz * face[u + 2] >= creaseDot) {
        const w = angle[o];
        x += face[u] * w;
        y += face[u + 1] * w;
        z += face[u + 2] * w;
      }
    }
    const length = Math.hypot(x, y, z);
    if (length > 0) {
      x /= length;
      y /= length;
      z /= length;
    } else {
      x = fx;
      y = fy;
      z = fz;
    }
    normals[c * 3] = x;
    normals[c * 3 + 1] = y;
    normals[c * 3 + 2] = z;
  }
  return normals;
}

/** Replaces the geometry's normals by creased ones. It ends up unindexed. */
export function applyCreasedNormals(
  geometry: BufferGeometry,
  creaseAngle: number = DEFAULT_CREASE_ANGLE,
): BufferGeometry {
  const position = geometry.getAttribute("position");
  const normals = creasedNormals(
    position.array,
    geometry.index ? geometry.index.array : null,
    creaseAngle,
  );
  const result = geometry.index ? geometry.toNonIndexed() : geometry;
  result.setAttribute("normal", new BufferAttribute(normals, 3));
  return result;
}

function cornerAngle(dot: number, lengths: number): number {
  return lengths > 0 ? Math.acos(Math.max(-1, Math.min(1, dot / lengths))) : 0;
}

/**
 * Gives vertices at exactly the same position the same id (the id of the
 * first of them). Open addressing on the bits of the coordinates.
 */
function weldVertices(positions: ArrayLike<number>): Uint32Array {
  const count = Math.floor(positions.length / 3);
  const ids = new Uint32Array(count);
  let size = 16;
  while (size < count * 2) size *= 2;
  const mask = size - 1;
  const table = new Int32Array(size).fill(-1);
  const scratch = new Float32Array(3);
  const bits = new Uint32Array(scratch.buffer);
  const key = new Uint32Array(count * 3);
  for (let v = 0; v < count; v++) {
    // Adding 0 turns -0 into 0, so both hash alike.
    scratch[0] = positions[v * 3] + 0;
    scratch[1] = positions[v * 3 + 1] + 0;
    scratch[2] = positions[v * 3 + 2] + 0;
    key[v * 3] = bits[0];
    key[v * 3 + 1] = bits[1];
    key[v * 3 + 2] = bits[2];
    let h =
      (Math.imul(bits[0], 0x9e3779b1) ^
        Math.imul(bits[1], 0x85ebca6b) ^
        Math.imul(bits[2], 0xc2b2ae35)) >>>
      0;
    h = (h ^ (h >>> 15)) & mask;
    for (;;) {
      const other = table[h];
      if (other < 0) {
        table[h] = v;
        ids[v] = v;
        break;
      }
      if (
        key[other * 3] === bits[0] &&
        key[other * 3 + 1] === bits[1] &&
        key[other * 3 + 2] === bits[2]
      ) {
        ids[v] = other;
        break;
      }
      h = (h + 1) & mask;
    }
  }
  return ids;
}

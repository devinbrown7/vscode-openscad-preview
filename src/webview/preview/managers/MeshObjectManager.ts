import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshPhongMaterial,
  Object3D,
} from "three";
import { MeshGeometry } from "../../../shared/types/MeshGeometry";
import { MeshObjectUpdate } from "../../../shared/types/MeshObjectUpdate";

/** The triangles of one material of a mesh object. */
interface MaterialPart {
  name: string;
  geometry: BufferGeometry;
}

/**
 * Builds scene objects from mesh objects, as the 3MF loader builds them
 * from a 3MF: a group per object, with a mesh per material. It keeps
 * each key's geometry from the last load, so an update that leaves a
 * key's geometry out reuses it. Geometry of keys that are gone is freed.
 */
export class MeshObjectManager {
  private parts = new Map<string, MaterialPart[]>();

  /** The objects' scene objects. `color` is for objects without one. */
  public load(objects: MeshObjectUpdate[], color: Color): Object3D[] {
    const kept = new Map<string, MaterialPart[]>();
    const loaded: Object3D[] = [];
    for (const object of objects) {
      const parts =
        kept.get(object.key) ??
        this.parts.get(object.key) ??
        (object.geometry && splitByMaterial(object.geometry));
      if (!parts) {
        console.error(`No geometry for mesh object ${object.key}`);
        continue;
      }
      kept.set(object.key, parts);
      loaded.push(buildObject(object, parts, color));
    }
    for (const [key, parts] of this.parts) {
      if (!kept.has(key)) parts.forEach((p) => p.geometry.dispose());
    }
    this.parts = kept;
    return loaded;
  }

  /** Frees all geometry, as when a model file replaces the mesh objects. */
  public clear() {
    for (const parts of this.parts.values()) {
      parts.forEach((p) => p.geometry.dispose());
    }
    this.parts.clear();
  }
}

function buildObject(
  object: MeshObjectUpdate,
  parts: MaterialPart[],
  fallback: Color,
): Object3D {
  const group = new Group();
  group.name = object.name;
  group.position.set(...object.position);
  const { color, opacity } = parseColor(object.color) ?? {
    color: fallback,
    opacity: 1,
  };
  for (const part of parts) {
    const material = new MeshPhongMaterial({
      color,
      opacity,
      transparent: opacity < 1,
      flatShading: true,
    });
    material.name = part.name;
    const mesh = new Mesh(part.geometry, material);
    mesh.name = object.name;
    group.add(mesh);
  }
  return group;
}

/** `#RRGGBB` or `#RRGGBBAA`. */
function parseColor(
  hex: string | undefined,
): { color: Color; opacity: number } | null {
  const match = hex && /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex);
  if (!match) return null;
  const opacity = match[2] ? parseInt(match[2], 16) / 255 : 1;
  return { color: new Color(`#${match[1]}`), opacity };
}

/**
 * Splits a mesh into one geometry per material, without an index and
 * with flat normals, so every triangle shades flat as in a 3MF load.
 */
function splitByMaterial(mesh: MeshGeometry): MaterialPart[] {
  const { positions, indices, materials, triangleMaterials } = mesh;
  const counts = new Uint32Array(materials.length);
  for (const m of triangleMaterials) counts[m]++;
  const position = Array.from(counts, (n) => new Float32Array(n * 9));
  const normal = Array.from(counts, (n) => new Float32Array(n * 9));
  const filled = new Uint32Array(materials.length);
  for (let t = 0; t < triangleMaterials.length; t++) {
    const m = triangleMaterials[t];
    const out = filled[m];
    filled[m] += 9;
    const p = position[m];
    for (let k = 0; k < 3; k++) {
      const v = indices[t * 3 + k] * 3;
      p[out + k * 3] = positions[v];
      p[out + k * 3 + 1] = positions[v + 1];
      p[out + k * 3 + 2] = positions[v + 2];
    }
    // The normal of the triangle: (b - a) × (c - a), normalized.
    const ux = p[out + 3] - p[out];
    const uy = p[out + 4] - p[out + 1];
    const uz = p[out + 5] - p[out + 2];
    const vx = p[out + 6] - p[out];
    const vy = p[out + 7] - p[out + 1];
    const vz = p[out + 8] - p[out + 2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;
    const n = normal[m];
    for (let k = 0; k < 9; k += 3) {
      n[out + k] = nx;
      n[out + k + 1] = ny;
      n[out + k + 2] = nz;
    }
  }
  const parts: MaterialPart[] = [];
  materials.forEach((name, m) => {
    if (counts[m] === 0) return;
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(position[m], 3),
    );
    geometry.setAttribute("normal", new Float32BufferAttribute(normal[m], 3));
    parts.push({ name, geometry });
  });
  return parts;
}

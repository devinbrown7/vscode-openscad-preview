/**
 * A triangle mesh as typed arrays, ready for the GPU: no file to parse.
 * Each triangle can name a material, as a 3MF base material does.
 */
export interface MeshGeometry {
  /** x, y and z of each vertex. */
  positions: Float32Array;
  /** Three vertex indices per triangle. */
  indices: Uint32Array;
  /** Material names. An empty name is no material. */
  materials: string[];
  /** Each triangle's index into `materials`. */
  triangleMaterials: Uint32Array;
}

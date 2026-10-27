import { MeshGeometry } from "./MeshGeometry";

/**
 * A top-level object of a model, as a mesh. A preview session that makes
 * its own meshes renders these instead of a model file.
 */
export interface MeshObject {
  /**
   * Names the geometry: the same key, the same geometry. The webview
   * keeps the geometry of the keys it has, so an update only sends the
   * geometry that changed.
   */
  key: string;
  /** The object's name, as a 3MF object's. Objects can share a name. */
  name: string;
  /** `#RRGGBB` or `#RRGGBBAA`; the theme's model color when undefined. */
  color?: string;
  /** Where the object is moved to. */
  position: [number, number, number];
  geometry: MeshGeometry;
}

import { MeshGeometry } from "./MeshGeometry";
import { MeshObject } from "./MeshObject";

/**
 * A mesh object as the webview gets it. The geometry is left out when
 * the webview has the key from the last update.
 */
export type MeshObjectUpdate = Omit<MeshObject, "geometry"> & {
  geometry?: MeshGeometry;
};

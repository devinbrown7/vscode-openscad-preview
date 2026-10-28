/* eslint-disable @typescript-eslint/no-explicit-any */
import { Group, Mesh } from "three";
import {
  RenderMode,
  ViewOptionsContext,
} from "../../contexts/ViewOptionsContext";

export class MaterialManager {
  public applyToGroup(group: Group, settings: ViewOptionsContext) {
    group.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = settings.get("shadows");
        child.receiveShadow = settings.get("shadows");
        this.applyToMesh(child, settings);
      }
    });
  }

  private applyToMesh(mesh: Mesh, viewSettings: ViewOptionsContext) {
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    materials.forEach((mat) => {
      if (mat && "wireframe" in mat) {
        (mat as any).wireframe = viewSettings.is(
          "renderMode",
          RenderMode.Wireframe,
        );

        if ("flatShading" in mat) {
          // Wireframe shows edges, so it shades smooth either way.
          (mat as any).flatShading =
            !viewSettings.get("smoothShading") &&
            !viewSettings.is("renderMode", RenderMode.Wireframe);
        }

        if (mat.userData.originalColor !== undefined) {
          if ((mat as any).color) {
            (mat as any).color.copy(mat.userData.originalColor);
          }
          if ("vertexColors" in mat) {
            (mat as any).vertexColors = mat.userData.originalVertexColors;
          }
        }

        (mat as any).needsUpdate = true;
      }
    });
  }
}

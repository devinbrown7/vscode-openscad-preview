import { createContext } from "@lit/context";
import { MeshObjectUpdate } from "../../shared/types/MeshObjectUpdate";
import { ModelFormat } from "../../shared/types/ModelFormat";

export interface ModelContext {
  format: ModelFormat | null;
  base64Data: string | null;
  /** The model as mesh objects, instead of a model file. */
  meshes: MeshObjectUpdate[] | null;
  isLoading: boolean;
  loadingMessage: string;
  export: () => void;
  sendToSlicer: () => void;
}

export const modelContext = createContext<ModelContext>("model");

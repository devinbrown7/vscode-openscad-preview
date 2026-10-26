import { createContext } from "@lit/context";

/** A top-level object of the loaded model. Objects that share a name are one entry. */
export interface ModelObject {
  name: string;
  visible: boolean;
}

export interface ModelObjectsContext {
  objects: ModelObject[];
  setVisible: (name: string, visible: boolean) => void;
}

export const modelObjectsContext =
  createContext<ModelObjectsContext>("modelObjects");

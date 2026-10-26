import { ModelFormat } from "../../shared/types/ModelFormat";

export interface ExportFormatOption {
  value: ModelFormat;
  label: string;
  description: string;
}

/**
 * Options for a ScadWebviewPanel. Each one is optional, and without it the
 * panel works as it always has for OpenSCAD.
 */
export interface PreviewPanelOptions {
  /** The settings section that holds `previewFormat` and `slicerExecutable`. Defaults to `openscad`. */
  configSection?: string;
  /** The formats Export offers. Defaults to 3MF and STL. With one format, Export skips the quick pick. */
  exportFormats?: readonly ExportFormatOption[];
  /** The source file's extension, which Export swaps for the format's in the suggested file name. Defaults to `.scad`. */
  sourceExtension?: RegExp;
  /** Whether a failed render shows a notification. Defaults to true. The log panel shows the error either way. */
  notifyRenderErrors?: boolean;
}

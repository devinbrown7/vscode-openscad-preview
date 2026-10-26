import { Event, Uri } from "vscode";
import { ModelFormat } from "../../shared/types/ModelFormat";
import { ScadParameter } from "../../shared/types/ScadParameter";
import { SourceLocation } from "../../shared/types/SourceLocation";

/** A finished render: the model file and its format. */
export interface RenderResult {
  buffer: Buffer;
  format: ModelFormat;
}

export interface ParametersChangedEvent {
  parameters: ScadParameter[];
  parameterSets: Record<string, Record<string, string>>;
  activeSetName: string | undefined;
  overrides: Record<string, string | number | boolean>;
}

/**
 * What ScadWebviewPanel needs from the document it shows. ScadSession
 * implements it for OpenSCAD. Another session type can implement it to
 * reuse the panel and the webview.
 */
export interface PreviewSession {
  readonly documentUri: Uri;

  readonly onRenderStarted: Event<void>;
  readonly onRenderCompleted: Event<RenderResult>;
  readonly onRenderError: Event<Error>;
  readonly onParametersChanged: Event<ParametersChangedEvent>;
  readonly onLog: Event<string>;

  readonly currentParameters: ScadParameter[];
  readonly currentOverrides: Record<string, string | number | boolean>;
  readonly activeSetName: string | undefined;
  readonly currentParameterSets: Record<string, Record<string, string>>;

  updateParameterValue(
    name: string,
    value: string | number | boolean | undefined,
  ): void;
  saveParameterSet(name: string): Promise<void>;
  deleteParameterSet(name: string): Promise<void>;
  applyParameterSet(name: string | undefined): void;

  /** Renders the model in the given format, for export. */
  exportFormat(format: ModelFormat): Promise<Buffer>;

  /**
   * Where a named 3MF material of an object comes from, for sessions
   * whose models name them after their source. Ctrl+click (Cmd+click on
   * macOS) on the material opens it.
   */
  locateMaterial?(object: string, material: string): SourceLocation | undefined;
}

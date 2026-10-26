import {
  Disposable,
  Memento,
  Position,
  ProgressLocation,
  Range,
  Uri,
  ViewColumn,
  Webview,
  WebviewPanel,
  env,
  window,
  workspace,
} from "vscode";
import * as os from "os";
import * as path from "path";
import * as cp from "child_process";
import { ExtensionToWebviewMessage } from "../../shared/types/ExtensionToWebviewMessage";
import { ModelFormat } from "../../shared/types/ModelFormat";
import { SourceLocation } from "../../shared/types/SourceLocation";
import { WebviewToExtensionMessage } from "../../shared/types/WebviewToExtensionMessage";
import { PreviewSession } from "../core/PreviewSession";
import { PreviewPanelOptions } from "./PreviewPanelOptions";

type LoadingState = Extract<
  ExtensionToWebviewMessage,
  { type: "loadingState" }
>;

export class ScadWebviewPanel {
  private readonly panel: WebviewPanel;
  private disposables: Disposable[] = [];
  private isWebviewReady: boolean = false;
  private lastRender: { base64Data: string; format: ModelFormat } | undefined;
  // The latest render's loading state and log. A render can start, log and
  // even fail before the webview is ready, so a new webview gets them too.
  private loadingState: LoadingState | undefined;
  private renderLog: string[] = [];

  private get sceneStateKey(): string {
    return `openscad.scene.${this.session.documentUri.toString()}`;
  }

  constructor(
    panel: WebviewPanel,
    private readonly extensionUri: Uri,
    private readonly session: PreviewSession,
    private readonly workspaceState: Memento,
    private readonly options: PreviewPanelOptions = {},
  ) {
    this.panel = panel;

    // Configure webview
    this.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        Uri.joinPath(extensionUri, "dist"),
        Uri.joinPath(extensionUri, "node_modules", "three"),
        Uri.joinPath(extensionUri, "node_modules", "@vscode", "codicons"),
        Uri.joinPath(extensionUri, "src", "webview"),
      ],
    };

    // Set initial HTML content
    this.panel.webview.html = this.getWebviewHtml(
      this.panel.webview,
      extensionUri,
    );

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => {
        switch (message.type) {
          case "ready":
            this.isWebviewReady = true;
            this.pushInitialState();
            return;
          case "parameterChanged":
            this.session.updateParameterValue(message.name, message.value);
            return;
          case "saveParameterSet":
            this.session.saveParameterSet(message.name);
            return;
          case "promptSaveParameterSet":
            window.showInputBox({
              prompt: "Enter new parameter set name:",
              placeHolder: "Preset Name",
            }).then((name) => {
              if (name && name.trim()) {
                this.session.saveParameterSet(name.trim());
              }
            });
            return;
          case "deleteParameterSet":
            window.showWarningMessage(
              `Are you sure you want to delete the "${message.name}" parameter set?`,
              { modal: true },
              "Delete"
            ).then((selection) => {
              if (selection === "Delete") {
                this.session.deleteParameterSet(message.name);
              }
            });
            return;
          case "applyParameterSet":
            this.session.applyParameterSet(message.name);
            return;
          case "exportModel":
            this.exportModel();
            return;
          case "sendToSlicer":
            this.sendToSlicer();
            return;
          case "persistScene":
            this.workspaceState.update(this.sceneStateKey, message.snapshot);
            return;
          case "openLocation":
            this.openLocation(message.location);
            return;
          case "openMaterial": {
            const location = this.session.locateMaterial?.(
              message.object,
              message.material,
            );
            if (location) this.openLocation(location);
            return;
          }
          case "error":
            window.showErrorMessage(`Preview Error: ${message.message}`);
            return;
        }
      },
      null,
      this.disposables,
    );

    // Subscribe to session events
    this.session.onRenderStarted(
      () => {
        this.renderLog = [];
        this.setLoadingState({
          type: "loadingState",
          loading: true,
          message: "Generating model...",
        });
      },
      null,
      this.disposables,
    );

    this.session.onRenderCompleted(
      ({ buffer, format }) => {
        if (buffer.toString() === "loading") {
          this.setLoadingState({
            type: "loadingState",
            loading: true,
            message: "Loading model...",
          });
          return;
        }

        // The update itself clears the webview's loading state.
        this.loadingState = undefined;
        const base64Data = buffer.toString("base64");
        this.lastRender = { base64Data, format };
        this.postMessage({
          type: "update",
          content: base64Data,
          format,
        });
      },
      null,
      this.disposables,
    );

    this.session.onRenderError(
      (err) => {
        // Clear the loading spinner so the webview doesn't hang indefinitely.
        this.setLoadingState({
          type: "loadingState",
          loading: false,
        });

        // Show the error in the VS Code notification area and direct the user
        // to the output channel for the full OpenSCAD stderr output.
        const msg = err.message;
        if (this.options.notifyRenderErrors ?? true) {
          window
            .showErrorMessage(
              `OpenSCAD render failed: ${msg.split("\n")[0]}`,
              "Show Output",
            )
            .then((choice) => {
              if (choice === "Show Output") {
                // The output channel is named "OpenSCAD Preview" — reveal it.
                // We can't reference it directly here, but the user can open it
                // from View > Output and select "OpenSCAD Preview".
                window.showInformationMessage(
                  'Open the Output panel and select "OpenSCAD Preview" from the dropdown to see the full error.',
                );
              }
            });
        }

        // Also forward the first line of the error to the webview log panel.
        this.postLog(`ERROR: ${msg}`);
      },
      null,
      this.disposables,
    );

    this.session.onParametersChanged(
      ({ parameters, parameterSets, activeSetName, overrides }) => {
        if (this.isWebviewReady) {
          this.postMessage({
            type: "updateParameters",
            parameters,
            parameterSets,
            activeSetName,
            overrides,
          });
        }
      },
      null,
      this.disposables,
    );

    this.session.onLog(
      (message) => this.postLog(message),
      null,
      this.disposables,
    );

    // Clean up on panel close
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private getWebviewHtml(webview: Webview, extensionUri: Uri): string {
    // Get path to compiled preview script
    const scriptUri = webview.asWebviewUri(
      Uri.joinPath(extensionUri, "dist", "webview.js"),
    );

    const codiconUri = webview.asWebviewUri(
      Uri.joinPath(
        extensionUri,
        "node_modules",
        "@vscode",
        "codicons",
        "dist",
        "codicon.css",
      ),
    );

    // Only the bundled script runs, and nothing loads from the network.
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const csp = [
      "default-src 'none'",
      `script-src 'nonce-${nonce}'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      `img-src ${webview.cspSource} data: blob:`,
    ].join("; ");

    return /* html */ `
		<!DOCTYPE html>
		<html>
			<head>
				<meta charset="UTF-8" />
				<meta http-equiv="Content-Security-Policy" content="${csp}" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>OpenSCAD Preview</title>
        <link rel="stylesheet" href="${codiconUri}" id="vscode-codicon-stylesheet">
				<style>
					body { 
						margin: 0; 
						padding: 0;
						height: 100vh;
						display: flex;
						flex-direction: column;
						overflow: hidden;
						background-color: var(--vscode-editor-background);
						color: var(--vscode-foreground);
						font-family: var(--vscode-font-family);
						font-size: var(--vscode-font-size);
					}
					#root {
						flex: 1;
						display: flex;
						overflow: hidden;
						height: 100%;
					}
				</style>
			</head>
			<body>
				<div id="root"></div>
				<script nonce="${nonce}" src="${scriptUri}" type="module"></script>
			</body>
		</html>
	`;
  }

  private pushInitialState() {
    // Send the persisted scene snapshot first so the webview can hydrate
    // before any other state arrives. `null` means "no saved scene" — the
    // webview falls back to its built-in default scene.
    const snapshot = this.workspaceState.get<unknown>(this.sceneStateKey, null);
    this.postMessage({ type: "loadScene", snapshot });

    // Send initial parameters
    const params = this.session.currentParameters;
    const overrides = this.session.currentOverrides;
    const parameterSets = this.session.currentParameterSets;
    const activeSetName = this.session.activeSetName;

    if (params && params.length > 0) {
      this.postMessage({
        type: "updateParameters",
        parameters: params,
        parameterSets,
        activeSetName,
        overrides,
      });
    }

    // Re-send the last completed render so the model is visible immediately,
    // both when the tab first loads (race condition where the render may have
    // completed before the webview was ready) and on tab re-focus (where
    // VSCode destroys and recreates the webview content).
    if (this.lastRender) {
      this.postMessage({
        type: "update",
        content: this.lastRender.base64Data,
        format: this.lastRender.format,
      });
    }

    // Then the latest render's loading state and log, which the webview
    // misses if the render ran before it was ready.
    if (this.loadingState) {
      this.postMessage(this.loadingState);
    }
    for (const message of this.renderLog) {
      this.postMessage({ type: "log", message });
    }
  }

  private setLoadingState(state: LoadingState) {
    this.loadingState = state;
    this.postMessage(state);
  }

  /** Sends a chunk of the latest render's log, and keeps it for a new webview. */
  private postLog(message: string) {
    this.renderLog.push(message);
    if (this.isWebviewReady) {
      this.postMessage({ type: "log", message });
    }
  }

  private async exportModel() {
    const formats = this.options.exportFormats ?? [
      {
        value: ModelFormat.ThreeMF,
        label: "3MF",
        description: "Supports colors but requires OpenSCAD Nightly.",
      },
      {
        value: ModelFormat.STL,
        label: "STL",
        description: "Universally supported.",
      },
    ];
    const format =
      formats.length === 1
        ? formats[0]
        : await window.showQuickPick(formats, {
            title: "Select Export Format",
          });

    if (!format) {
      return; // User cancelled
    }

    // Attempt to inject Parameter Set Name if active
    // We would need access to the session's activeSetName
    const activeSetName = this.session.activeSetName;
    const appendix = activeSetName ? ` - ${activeSetName}` : "";

    const defaultUri = Uri.file(
      this.session.documentUri.fsPath.replace(
        this.options.sourceExtension ?? /\.scad$/i,
        `${appendix}.${format.value}`,
      ),
    );

    const filters = {
      [format.label]: [format.value],
    };

    const uri = await window.showSaveDialog({
      defaultUri,
      filters,
      title: `Export ${format.label}`,
    });

    if (uri) {
      try {
        // We display a localized progress UI so the user knows an on-demand background render is happening
        await window.withProgress(
          {
            location: ProgressLocation.Notification,
            title: `Rendering ${format.label}...`,
            cancellable: false,
          },
          async () => {
            const buffer = await this.session.exportFormat(format.value);
            await workspace.fs.writeFile(uri, new Uint8Array(buffer));
          },
        );

        window.showInformationMessage(
          `Successfully exported ${format.label} to ${uri.fsPath}`,
        );
      } catch (error) {
        window.showErrorMessage(`Failed to export ${format.label}: ${error}`);
      }
    }
  }

  private async sendToSlicer() {
    try {
      await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: "Sending to Slicer...",
          cancellable: false,
        },
        async () => {
          const config = workspace.getConfiguration(
            this.options.configSection ?? "openscad",
          );
          const formatValue = config.get<string>("previewFormat") || "3mf";
          const format = formatValue === "stl" ? ModelFormat.STL : ModelFormat.ThreeMF;
          
          const buffer = await this.session.exportFormat(format);
          
          const activeSetName = this.session.activeSetName;
          const appendix = activeSetName ? `_${activeSetName.replace(/[^a-z0-9]/gi, '_')}` : "";
          const timestamp = new Date().getTime();
          const tmpFilePath = path.join(
            os.tmpdir(),
            `openscad_preview${appendix}_${timestamp}.${format}`,
          );
          const uri = Uri.file(tmpFilePath);
          
          await workspace.fs.writeFile(uri, new Uint8Array(buffer));
          
          const slicerExecutable = config.get<string>("slicerExecutable");
          
          if (slicerExecutable && slicerExecutable.trim() !== "") {
            cp.execFile(slicerExecutable.trim(), [tmpFilePath], (error) => {
              if (error) {
                window.showErrorMessage(`Failed to launch slicer: ${error.message}`);
              }
            });
          } else {
            await env.openExternal(uri);
          }
        },
      );
    } catch (error) {
      window.showErrorMessage(`Failed to send to slicer: ${error}`);
    }
  }

  /**
   * Opens a file from a log line, in the column that shows it, else in the
   * previewed document's column.
   */
  private async openLocation(location: SourceLocation) {
    const file = path.resolve(
      path.dirname(this.session.documentUri.fsPath),
      location.file,
    );
    const position = new Position(
      Math.max(location.line - 1, 0),
      Math.max((location.column ?? 1) - 1, 0),
    );
    try {
      const document = await workspace.openTextDocument(Uri.file(file));
      const shows = (uri: Uri) =>
        window.visibleTextEditors.find(
          (e) => e.document.uri.fsPath === uri.fsPath,
        );
      const editor = shows(document.uri) ?? shows(this.session.documentUri);
      await window.showTextDocument(document, {
        viewColumn: editor?.viewColumn ?? ViewColumn.One,
        selection: new Range(position, position),
      });
    } catch (error) {
      window.showErrorMessage(`Could not open ${file}: ${error}`);
    }
  }

  private postMessage(message: ExtensionToWebviewMessage) {
    this.panel.webview.postMessage(message);
  }

  public dispose() {
    this.panel.dispose();
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}

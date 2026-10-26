---
"vscode-openscad-preview": patch
---

Internal: the preview panel now works with any session that implements the new `PreviewSession` interface, and takes optional `PreviewPanelOptions`. `ScadSession` implements the interface, and the OpenSCAD preview works as before.

---
"vscode-openscad-preview": minor
---

A preview session can render its model as mesh objects instead of a model file: typed arrays with a material per triangle, which the webview shows without parsing a file. Each object has a key for its geometry. The webview keeps the geometry of the keys it has, so an update only sends the objects that changed.

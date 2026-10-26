---
"vscode-openscad-preview": patch
---

The preview no longer misses the log of a render that ran before it finished loading, and a failed render no longer leaves the "Rendering SCAD..." spinner up when there is no model yet. Hiding and showing the preview tab also keeps the latest render's log.

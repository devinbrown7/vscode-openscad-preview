---
"vscode-openscad-preview": patch
---

Dragging a number parameter now snaps to steps counted from its minimum, as OpenSCAD's customizer does. A `[1:5:50]` parameter gives 1, 6, 11, ... 46 instead of multiples of 5.

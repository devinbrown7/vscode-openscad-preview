---
"vscode-openscad-preview": patch
---

Parameter labels drop the group name only when it is the whole first word or words of the name. Before, `holes` in a group named `Hole` showed as `S`, a parameter named like its group showed an empty label, and a group name with regex characters, such as `C++`, broke the Parameters panel.

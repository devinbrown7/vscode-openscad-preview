---
"vscode-openscad-preview": patch
---

The preview webview now has a Content Security Policy: only the extension's own bundled script runs, and nothing loads from the network. The unused Google Fonts stylesheet is gone, so opening a preview no longer makes a request to Google.

# Inkdown

**A local-first WYSIWYG Markdown editor built with Tauri 2, React, TypeScript, and Tiptap.**

Markdown markers become rich formatting as you type. Documents are saved as plain `.md` files, ideal for storing in any Git repository.

## Requirements (Windows)

- Node.js 20+
- Rust via [rustup](https://rustup.rs/)
- Microsoft C++ Build Tools (Desktop development with C++)
- WebView2 (included with most modern Windows installations)
- Git (optional for versioning notes)

See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

## Quick start

```powershell
npm install
npm run desktop
```

To produce an installer:

```powershell
npm run bundle
```

Windows installers appear under `src-tauri/target/release/bundle/`.

## Features in v0.1

- Single-pane live WYSIWYG editing: `**bold**`, `*italic*`, backtick inline code, `~~strike~~`, headings and list shortcuts
- Toolbar for basic formatting and undo/redo
- Open existing Markdown files (Ctrl+O)
- Save Markdown files (Ctrl+S); Save As (Ctrl+Shift+S)
- New document (Ctrl+N), unsaved-change warning
- Word count and file status
- Native filesystem access through Tauri commands
- All documents are portable, plain-text Markdown; **no cloud account or server required**

## Git tracking

Inkdown does **not** automatically make Git commits. To track a document folder, initialize Git once in the folder and save Markdown there:

```powershell
cd C:\\path\\to\\notes
git init
git add .
git commit -m "Initial notes"
```

After editing in Inkdown, commit the changed `.md` files using Git or a Git GUI. The editor project itself is also Git ready.

## Notes

- Tiptap's Markdown import/export extension is currently beta. Complex Markdown (especially HTML, comments, and advanced tables) may not round-trip perfectly. Keep backups for important existing documents.
- This MVP uses the system file dialogs for selecting files and a minimal Rust bridge to read/write them. It currently does not provide integrated Git status, commit buttons, file watching, or multiple tabs.
- `npm run dev` opens a browser preview of the interface, but native Open/Save actions only function under `npm run desktop`.

# Standalone Mode for Markdown Files

## Overview

Standalone mode allows users to open a plain Markdown file (or a directory that is not a Hubble workspace) directly from the file manager or via the OS `Open With` dialog. The desktop app launches a simplified instance:

* Only a single, focused window is created. All workspace‑specific UI such as the sidebar, Workspace picker, and Cloud Sync status is omitted.
* The editor is opened with *Source Mode* enabled by default so the raw Markdown is visible. Users can switch to WYSIWYG rendering using the existing toggle.
* Multiple files can be opened in a tabbed interface. The tabs display only the file name (or the relative path if inside a folder) and the editor content.

#### Use Cases
* Quick note editing – a user double‑clicks *note.md* in Finder and expects a lightweight editing window.
* Viewing a delivered set of Markdown without the entire workspace context.
* Editing notes that are not yet in a workspace but will be migrated later.

## Functional Requirements

1. **Detect standalone invocation** – When the app is started with a file path that is not part of a previously granted workspace or a plain folder, create a new window that renders only the editor.
2. **Create a minimal `BrowserWindow`** – The new window should have no menu bar, no sidebar, and minimal size constraints.
3. **Tab management** – Expose a simple tab bar in the renderer to hold multiple files. Window state is managed via compile-time `useFileActions` hook modifications.
4. **Persist state** – Keep window size, zoom factor, and tab selection across restarts – backed by a lightweight JSON store separate from the workspace grants.
5. **Security** – Running outside a workspace still needs strict file access: only the opened file(s) and their immediate assets folder should be reachable.
6. **Graceful exit** – When all tabs are closed, the standalone window quits automatically.

## Design Decisions

* **Separate renderer** – Use the same renderer entry (`src/App.tsx`) but pass a `mode="standalone"` flag via IPC or a URL query string. This keeps the logic in a single place.
* **Minimal menu** – Override the default menu with a minimal set that only exposes *File → Open…* and *File → Save*.
* **State file** – Store `standalone-settings.json` in the user's app data folder with the fields:
  ```json
  {
    "windowBounds": { "width": 900, "height": 800 },
    "zoomFactor": 1,
    "openTabs": ["/Users/alice/notes/quick.md"]
  }
  ```
* **Frontend store** – Extend `useTabs` hook to initialise from this JSON and persist changes via IPC.

## Implementation Highlights

### Electron Main
* Add `createStandaloneWindow(filePath?: string)` that creates a new `BrowserWindow` with the `standalone` flag.
* Keep a map of open standalone windows to avoid duplicates.
* Handle `open-file` event differently: if the file is not part of a granted workspace, call `createStandaloneWindow`.

### IPC
* `desktop:standalone:save-settings` – Persist settings.
* `desktop:standalone:load-settings` – Load settings at startup.
* `desktop:standalone:close` – Close a tab and possibly the window.

### Renderer
* In `App.tsx`, read the query `?standalone=1` via `new URL(location.href).searchParams.get("standalone")`.
* Render `StandaloneEditor` instead of the full `WorkspaceEditor`.
* Implement a simple `Tabs` component that holds file paths and content.

### Tests
* Ensure that starting the app with a file path not in a workspace creates a standalone window.
* Verify tab switching, saving, and window persistence.

## User‑Facing Steps

1. **Open a file** – Double‑click a Markdown file in Finder / Explorer.
2. The app opens a window titled with the file name.
3. Edit – the source will be visible; toggle to WYSIWYG with `Alt‑⌘/Ctrl+U`.
4. To open more files, use *File → Open…* or `Cmd/Ctrl+O`.
5. Close all tabs to exit.

---

### Release Checklist

- [ ] Add tests for `createStandaloneWindow`.
- [ ] Update `package.json` scripts for optional `standalone` flag.
- [ ] Update `docs/plans` to reference the new feature.
- [ ] Verify security by attempting to access files outside the opened folder.
- [ ] Ensure UI elements are hidden when in standalone mode.

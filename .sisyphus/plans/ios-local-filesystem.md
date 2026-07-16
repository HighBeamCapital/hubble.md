# iOS App: Rewrite for Local Filesystem

## Context

The iOS app was built using the web app's Convex sync architecture, but the user has only used the desktop app — which is fully local (Electron IPC → filesystem). The iOS app needs to match the desktop model: read/write directly to the filesystem via Tauri commands, no cloud backend.

The white screen is caused by:
1. Missing `.env.local` (no `VITE_CONVEX_URL`)
2. `createStore("hubble-ios")` called independently in 4 files (separate store instances that never share state)
3. All actions wired to Convex instead of filesystem

## Approach

Mirror the desktop app's architecture:
- **Tauri API bridge** (`tauriApi.ts`) — typed wrapper around `@tauri-apps/api/core` invoke, matching the desktop's `DesktopApi` subset
- **Singleton store** (`store/state.ts`) — one `appStore` with derived slices, using `@simplestack/store` + `localStoragePersist`
- **Actions** (`store/actions.ts`) — adapted from desktop's `actions.ts`, calling `tauriApi` instead of `desktopApi`
- **Persistence** (`store/persistence.ts`) — same shape as desktop, keyed to `hubble-ios`

## Files to create

### 1. `apps/ios/src/tauriApi.ts` — Tauri filesystem bridge

Type definitions matching desktop's `DesktopApi` subset + invoke wrappers:

```
Types: FileEntry, FolderEntry, DirectoryListing, DeleteOptions
Functions: listDirectory, readFileText, writeFileText, createFolder,
           renameFile, pathExists, deleteFile, readBinaryFile,
           writeBinaryFile, resolvePath, realPath, getLaunchFilePath,
           getLaunchWorkspacePath, openFolderPicker, openExternalUrl
```

Uses `@tauri-apps/api/core` for `invoke()` and `@tauri-apps/plugin-dialog` for `open()`.

### 2. `apps/ios/src/store/persistence.ts` — State types + hydration

Adapted from desktop's `persistence.ts`:
- `WorkspaceState` (workspacePath, recentWorkspaces, lastOpenedPaths, sortMode, files, folders)
- `DocumentState` (currentPath, lastOpenedPath, content, diskContent, externalChange, status, error, viewMode)
- `UiState` (sidebarOpen, isSwitcherOpen — no terminal)
- `IOSState` = { workspace, document, ui }
- `STORAGE_KEY = "hubble-ios"`
- `getInitialState()` — hydrate from localStorage
- `serialize()` — persist subset

### 3. `apps/ios/src/store/state.ts` — Singleton store

Replace current re-export. Create stores once at module level:
```ts
export const appStore = store<IOSState>(getInitialState(), { middleware: [...] });
export const workspaceStore = appStore.select("workspace");
export const viewerStore = appStore.select("document");
export const uiStore = appStore.select("ui");
// + derived: workspacePathStore, currentPathStore, sidebarOpenStore, etc.
```

### 4. `apps/ios/src/store/actions.ts` — Filesystem actions

Adapted from desktop's `actions.ts`. Core functions:
- `openWorkspace(path?)` — set workspace, refresh files
- `loadPath(path)` — read file, update stores
- `savePathContent(path, content)` — write to disk
- `updateEditorContent(path, content)` — update live content
- `refreshFiles(path?)` — re-list directory
- `createMarkdownFileInFolder(parentPath)` — create empty .md
- `createFolderInFolder(parentPath)` — create folder
- `deleteMarkdownFile(path)` — delete + update stores
- `deleteFolder(path)` — recursive delete
- `renameMarkdownFile(path, nextName)` — rename
- `renameFolder(path, nextName)` — rename
- `clearViewer()` — reset to empty
- `setSidebarOpen(isOpen)`, `toggleSidebar()`
- `setSortMode(mode)`, `setWorkspaceSwitcherOpen(isOpen)`

Skip: terminal, chat, pinned notes, workspace config, link rewriting, move operations, HTML apps.

### 5. `apps/ios/src/lib/latest.ts` — Stale-call guard

Copy from desktop (14 lines). Used by `loadPath`.

### 6. `apps/ios/src/lib/filePath.ts` — Path utilities

Copy from desktop. Used by actions for `dirname`, `basename`, `joinPath`, `normalizePath`, etc.

### 7. `apps/ios/src/externalFileChange.ts` — Change classification

Copy from desktop (16 lines). Used by actions for conflict detection.

## Files to rewrite

### 8. `apps/ios/src/App.tsx` — Simplified routing

Remove Convex/`readConnection`/workspace-ID routing. New flow:
- On mount: check `localStorage["hubble-ios"]` for saved workspacePath
- If saved and path exists → render AppShell
- If not → render WelcomeScreen with "Open Folder" button
- No react-router needed (single screen, sidebar navigation)

### 9. `apps/ios/src/screens/OpenWorkspaceScreen.tsx` → `WelcomeScreen.tsx`

Replace Convex workspace picker with local folder picker:
- "Open Folder" button calls `tauriApi.openFolderPicker()`
- On select: calls `openWorkspace(path)` from actions
- Shows recent workspaces from store
- No Convex imports

### 10. `apps/ios/src/shell/AppShell.tsx`

Remove all Convex/`@hubble.md/app-core` imports. New structure:
- Import stores from `../store/state` (singleton)
- Import actions from `../store/actions`
- Use `AppShellFrame` from `@hubble.md/ui`
- Sidebar renders when `sidebarOpen` is true
- Editor shows when `viewer.currentPath` exists
- External change banner for conflicts
- New note form (create markdown file)
- Toolbar with hamburger, theme toggle, new note

### 11. `apps/ios/src/shell/Sidebar.tsx`

Remove `createStore` call. Import from `../store/state`:
- Subscribe to `workspaceStore` (files, folders, sortMode)
- Subscribe to `currentPathStore`
- Subscribe to `sidebarOpenStore`
- Pass filesystem actions to `SharedSidebar` (create, delete, rename, move)

### 12. `apps/ios/src/shell/Toolbar.tsx`

Remove `createStore` call. Import from `../store/state`:
- Subscribe to `currentPathStore`
- Subscribe to `sidebarOpenStore`
- Wire hamburger to `toggleSidebar()`

### 13. `apps/ios/src/shell/EditorView.tsx`

Remove `createStore` + `@hubble.md/app-core` imports:
- Import `savePathContent`, `updateEditorContent` from `../store/actions`
- Keep image paste/drop handlers
- Keep external link opening via `@tauri-apps/plugin-shell`

### 14. `apps/ios/src/main.tsx`

- Remove `VITE_CONVEX_URL` seeding
- Keep theme initialization
- Keep dynamic import of App + show()

## Files to delete

- `apps/ios/src/shell/WorkspaceSwitcher.tsx` (Convex-based, replace with recent workspaces list in WelcomeScreen)
- `apps/ios/src/store/state.ts` current content (replace with singleton)
- `apps/ios/.env.local` (if created)

## Packages to remove from `apps/ios/package.json`

- `@hubble.md/app-core`
- `@hubble.md/convex-client`
- `@hubble.md/sync-backend`
- `@hubble.md/sync`
- `convex`
- `react-router` + `react-router-dom` + `@react-router/node` + `@react-router/dev` (no routing needed)

## Packages to keep

- `@hubble.md/editor` (TipTap extensions)
- `@hubble.md/ui` (shared components: Sidebar, EditorView, AppShellFrame, Toolbar, ThemeToggle, etc.)
- `@simplestack/store` + `@simplestack/store-react`
- `@tauri-apps/api`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-shell`
- `@tiptap/*`, `react`, `react-dom`

## Cargo.toml changes

Keep existing plugins. No new crates needed — `tauri-plugin-dialog` already provides folder picker via `open()`.

## Capabilities

Already sufficient — `fs:default`, `dialog:default`, `shell:default` cover all needed permissions.

## Verification

1. `cd apps/ios && pnpm build` — Vite build passes
2. `cargo check --target aarch64-apple-ios` — Rust compiles
3. `pnpm build:desktop` — web app unaffected
4. Manual test: launch iOS app → WelcomeScreen → Open Folder → select folder → file tree appears → tap file → editor loads → edit → auto-saves → create/rename/delete files via sidebar

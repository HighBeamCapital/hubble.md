# Source Mode Technical Plan

## Context

Issue: https://github.com/bholmesdev/hubble.md/issues/142

Product spec: `specs/gh-142/PRODUCT.md`

Current commit researched: `19f98b4817256bc3cbc89f371761b6ab3d8c26a1`

Hubble desktop currently opens Markdown Files into `EditorView`, which parses front matter out of `initialMarkdown`, edits the body as a TipTap document, and recombines front matter plus body before `onLocalChange` and `onSave`. ADR-0003 establishes that File Properties live in YAML front matter and the full Markdown File remains the source of truth across desktop, web, Workspace Folders, Plain Folders, and Loose Files.

Relevant code:

- `apps/desktop/src/App.tsx`: `DocumentViewer`, `MarkdownEditor`, desktop save wiring, conflict banner, menu event handlers.
- `apps/desktop/src/components/Toolbar.tsx`: `NoteActionsMenu`, the right-side note overflow menu.
- `apps/desktop/src/store/state.ts`: `viewerStore`, `DocumentState`, `cleanFileState`, conflict baseline helpers.
- `apps/desktop/src/store/actions.ts`: `updateEditorContent`, `savePathContent`, file load/save/conflict actions.
- `apps/desktop/src/store/persistence.ts`: desktop state hydration/serialization. Persisted document state currently stores only `lastOpenedPath`.
- `packages/ui/src/editor/EditorView.tsx`: rich editor, frontmatter/body split, `HubbleCodeBlock` extension use.
- `packages/ui/src/editor/CodeBlockExtension.tsx`: `HubbleCodeBlock`, lowlight Markdown alias, code block controls, tab behavior.

## Affected Apps and Packages

`apps/desktop`

- Owns source/rich view state, toolbar menu entry, file switching reset, and save plumbing for desktop Markdown Files.

`packages/ui`

- Owns the reusable TipTap editor pieces. Add a source editor component here if it reuses `HubbleCodeBlock` and should be testable outside the desktop shell.

`packages/editor`

- No new Markdown parser behavior is planned. Existing `markdownToTiptapDoc` remains the rich-mode reconciliation path when returning from source mode.

## Module Architecture

Add `viewMode: "rich" | "source"` to desktop `DocumentState`.

- Default `emptyDoc()` mode: `"rich"`.
- `withOpenedDoc()` and successful reload/load paths reset to `"rich"` to satisfy PRODUCT behavior 14 and 19.
- `cleanFileState()` should not force mode by itself unless the caller is opening/reloading a file. This avoids `updateEditorContent()` accidentally switching modes while typing.
- Add `viewModeStore` only if a component needs direct selection; otherwise read from `viewerStore`.

Add desktop actions:

- `setViewerMode(mode: "rich" | "source")`
- `toggleSourceMode()` or `setViewMode()` for toolbar use.

`Toolbar` / `NoteActionsMenu`:

- Read current path and current `viewMode`.
- Show `Edit source` only for open Markdown Files.
- Toggle label to `Edit rich text` while source mode is active.
- Keep the item in the existing menu rather than adding another toolbar button.

`DocumentViewer`:

- Continue routing HTML App files to `HtmlDocumentViewer`.
- For Markdown Files, branch on `state.viewMode`.
- Rich branch keeps `MarkdownEditor`.
- Source branch renders a new `MarkdownSourceEditor`.

`MarkdownSourceEditor`:

- Receives `path`, `initialMarkdown`, `onLocalChange`, `onSave`, and `onScrollContainerChange`.
- Creates a minimal TipTap editor whose document is exactly one `codeBlock` node with `language: "md"` and text content equal to the whole Markdown File.
- Uses `HubbleCodeBlock` for highlighting and editing behavior.
- On update, reads the single code block text and calls `onLocalChange(path, markdown)` plus debounced `onSave(path, markdown)`, mirroring `EditorView`.
- On prop content changes from reload/conflict resolution, updates the code block without emitting local changes.
- On unmount, flushes pending save like `EditorView`.
- Sets the scroll container for toolbar scroll behavior and focuses the editor after mount.

`HubbleCodeBlock` reuse:

- Prefer a configurable node view option over duplicating the component. Add an option such as `sourceMode?: boolean` or `controls?: "default" | "source"` only if necessary.
- In source mode, hide or disable the language selector because PRODUCT behavior requires Markdown source, not user-selectable languages.
- The copy button can be hidden in source mode; whole-file copy is not part of this issue and normal selection copy still works.
- Preserve existing in-document code block controls for rich mode.

## Detailed Plan

1. Extend desktop document state.
   - Add `type ViewMode = "rich" | "source"` in `apps/desktop/src/store/state.ts`.
   - Add `viewMode` to `DocumentState` and `emptyDoc`.
   - Ensure file-open and reload actions set mode to `"rich"` where they replace the current document.
   - Leave `serialize()` unchanged so mode is not persisted.

2. Add mode actions.
   - Implement a small setter in `apps/desktop/src/store/actions.ts`.
   - When switching modes, only mutate `viewMode`; do not read from disk.
   - Rely on `viewerStore.content` as the in-memory source for the next view.

3. Add toolbar menu item.
   - In `NoteActionsMenu`, read current mode from `viewerStore`.
   - Add item after `Chat about this note` or near other document actions.
   - Use the same Base UI menu item styling.
   - Consider a code/text icon from the current icon set, but keep visual density consistent.

4. Implement `MarkdownSourceEditor`.
   - Place in `packages/ui/src/editor/MarkdownSourceEditor.tsx` if it can stay app-agnostic.
   - Export it from the UI package editor barrel if needed.
   - Use `StarterKit.configure({ codeBlock: false })` plus `HubbleCodeBlock.configure(...)`.
   - Define helpers to build/read a single code-block TipTap document.
   - Reuse `DEFAULT_SAVE_DEBOUNCE_MS` semantics from `EditorView`; consider extracting the constant only if duplication becomes noisy.

5. Wire source mode in desktop.
   - Import and render `MarkdownSourceEditor` from `apps/desktop/src/App.tsx`.
   - Pass `updateEditorContent`, `savePathContent`, and `setScrollContainerEl`.
   - Key by `path`, `viewMode`, and `HMR_REV` so switching modes creates the correct TipTap instance.

6. Reconcile source to rich.
   - No explicit conversion action is needed if source mode writes whole Markdown to `viewerStore.content`.
   - Switching to rich mode remounts `EditorView` with latest `initialMarkdown`, and `EditorView` already parses front matter and calls `markdownToTiptapDoc` on the body.

7. Conflict behavior.
   - Existing conflict banner stays outside `DocumentViewer`, so it applies to both modes.
   - Verify `reloadFromDiskConflict()` updates `content`; source editor must react to prop changes.
   - Verify `forceKeepLocalEdits()` saves `viewerStore.content`; source editor updates that through `onLocalChange`.

8. Tests.
   - Add store tests for default mode, toggling mode, non-persistence, and reset on file open.
   - Add UI/component tests for `MarkdownSourceEditor`: initializes with full source, calls local change/save with edited text, and updates from new props without emitting changes.
   - Add desktop component or integration coverage for menu label and `DocumentViewer` branch if existing test setup supports it.

## Testing and Validation

Map to product behavior:

- PRODUCT 1-4, 14-15: desktop component tests for note menu label/visibility and mode reset.
- PRODUCT 5, 9-13: `MarkdownSourceEditor` tests plus desktop store action tests.
- PRODUCT 16: existing external change action tests extended to assert mode/content behavior.
- PRODUCT 17-18: manual desktop validation.

Commands:

- Quick iteration: `pnpm check`
- Targeted tests: `pnpm --filter @hubble.md/desktop test` and UI/editor tests once added.
- Final confidence: `pnpm build:desktop`

Manual desktop validation:

1. Run `HUBBLE_DESKTOP_ENABLE_CDP=1 pnpm dev:desktop`.
2. Open a Workspace Folder or Plain Folder with a Markdown File containing front matter.
3. Switch to `Edit source`, confirm highlighted whole-file Markdown and initial focus.
4. Edit front matter and body, wait for save, switch to `Edit rich text`, confirm File Properties and body reflect edits.
5. Trigger or simulate an external disk conflict and verify banner actions update the visible source/rich content correctly.
6. Open an HTML App file and confirm source mode is not offered.

## Parallelization

Implementation is small enough for one agent. Parallel work would add coordination overhead because the state shape, toolbar, and editor component need to agree on the same mode semantics.

## Risks and Mitigations

- Data loss from stale saves: source editor should mirror `EditorView`'s debounce and unmount flush pattern.
- Frontmatter drift: source mode edits whole-file Markdown only; rich mode remains responsible for parsing front matter from `initialMarkdown`.
- Code block control leakage: make source-mode controls explicit so the in-document language selector does not let users switch away from Markdown highlighting.
- Invalid front matter: preserve raw source and rely on existing File Properties unavailable behavior rather than normalizing YAML.

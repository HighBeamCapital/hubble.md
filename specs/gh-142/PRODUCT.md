# Source Mode

## Summary

Source mode lets desktop users edit the exact raw Markdown for the open Markdown File, including front matter, without leaving Hubble. The user can switch between the normal rich editor and a full-page highlighted Markdown source editor from the note actions menu.

## Problem

The rich editor intentionally presents File Properties separately from the document body. Users still need an escape hatch for raw Markdown tasks: fixing malformed front matter, editing unsupported YAML, adjusting syntax the rich editor does not expose, or copying a whole file exactly as stored on disk.

## Goals

1. Make raw source editing available for the current desktop Markdown File.
2. Preserve the whole-file Markdown source as the source of truth.
3. Keep switching between rich and source views predictable and reversible.

## Non-goals

1. No source mode for HTML App files.
2. No split view, diff view, or preview mode.
3. No keyboard shortcut in this slice.
4. No new Markdown syntax support beyond editing the source text.

## Design Context

The entry point is the existing note actions overflow menu in the desktop toolbar. Source mode should feel like a mode switch on the current document, not a separate file opener. Rich mode remains the default when opening Markdown Files.

## Behavior

1. When a Markdown File is open on desktop, the note actions overflow menu includes an `Edit source` item.
2. Selecting `Edit source` switches the main content panel from the rich editor to a full-page source editor for the same file.
3. While source mode is active, the same menu item reads `Edit rich text`.
4. Selecting `Edit rich text` switches the main content panel back to the rich editor for the same file.
5. Source mode displays the whole Markdown File exactly as Hubble currently knows it, including YAML front matter, blank lines, comments, unsupported front matter fields, and the Markdown body.
6. The source editor fills the document area that the rich editor normally occupies. Existing app chrome, sidebar, terminal panel, update banners, and external-change conflict banner remain visible and behave normally.
7. Source mode uses a highlighted Markdown editing surface. It must not look or behave like an unstyled plain textarea.
8. Source mode is editable with normal text editing affordances: typing, deletion, selection, paste, undo/redo, scrolling, and tab indentation.
9. Edits made in source mode update the current file through the same save behavior users already get in rich mode. Users should not need a separate save command.
10. If the user switches back to rich mode after editing source, the rich editor reflects the latest source text.
11. If source edits include valid front matter, File Properties reflect those front matter changes after returning to rich mode.
12. If source edits include invalid or unsupported front matter, Hubble preserves that source text and shows the existing File Properties unavailable/unsupported behavior after returning to rich mode.
13. Switching modes must not discard unsaved in-memory edits. The visible next mode uses the latest editor content, not only the last content flushed to disk.
14. Opening another file resets the view to rich mode for Markdown Files.
15. Opening an HTML App file does not show source-mode controls and does not preserve a prior Markdown source-mode state.
16. When an external disk change conflict is shown, the conflict banner stays above either rich or source mode. `Reload from disk` replaces the source editor content with disk content; `Keep my edits` keeps the current source or rich edits.
17. Source mode keeps focus in the editing surface after switching into it.
18. The source editor is keyboard accessible as a document editing region and does not trap focus away from toolbar, sidebar, or terminal controls.
19. The current mode is local app view state only. Restarting the app or reopening a file starts in rich mode.
20. The feature is desktop-only until a separate web source-mode issue specifies web save and sync behavior.

## UX Validation

1. Open the desktop app with a Workspace Folder or Plain Folder containing a Markdown File with front matter.
2. Open the Markdown File, use the note actions menu, and choose `Edit source`.
3. Confirm the editor becomes a full-page highlighted Markdown source view, includes front matter, and receives focus.
4. Edit both front matter and body text, wait for save, switch back with `Edit rich text`, and confirm File Properties plus body content reflect the source edits.
5. Reopen or switch to another Markdown File and confirm the initial view is rich mode.

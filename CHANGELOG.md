# Changelog

All notable user-facing changes to Hubble. Entries are written as work lands
(see the `changelog` skill), then harvested into the desktop release notes.

Format loosely follows [Keep a Changelog](https://keepachangelog.com).

## [Unreleased]

### Added
- Terminal panel in the desktop app: toggle with Cmd+J to run shell commands in your workspace, with tabs, drag resize, and double click to rename
- Chat about the open note with your agent CLI: pick it from the note's ⋯ menu or press Cmd+Shift+J, and customize the command in Settings
- Add table support. Markdown tables now render as expected, and you can create new tables using `/table`. There are still editing features left to add, like adding and removing rows. Track progress on GitHub: [#99](https://github.com/bholmesdev/hubble.md/issues/99)
- Create HTML Apps from the new file dropdown, folder menus, and the File menu
- Empty HTML App files show a setup screen with the skill install command and a ready-to-copy agent prompt, with a check once the skills are detected

### Changed
- Keyboard shortcut hints now show the correct keys on Windows and Linux (Ctrl/Alt instead of macOS symbols)
- More buttons and menus now show their keyboard shortcut, including the format and slash command menus
- The HTML Apps popup in new workspaces is gone; setup now happens when you create an HTML App

### Fixed
- Desktop saves no longer drop trailing content in notes with multibyte characters
- Relative Markdown file links now open the linked file instead of showing an invalid URL error

## [0.1.16] - 2026-06-27

### Added
- Find text in the editor with highlighted matches and next/previous navigation
- Sidebar rows can now be multi-selected and moved together

### Fixed
- Editor word and character counts now reflect the selected text

## [0.1.15] - 2026-06-27

### Added
- Windows desktop builds (NSIS installer)

### Fixed
- HTML Apps and local images now load correctly on Windows
- Creating files/folders and revealing them in the file manager now work on Windows (paths are no longer doubled)

## [0.1.14] - 2026-06-25

### Added

- Linux desktop builds (AppImage and Debian package)
- Native window controls (minimize, maximize, close) on Windows and Linux

### Fixed
- Creating or renaming nested sidebar folders now keeps the folder tree in the expected shape
- The HTML Apps walkthrough video now loads in the packaged desktop dialog
- New task-list items created with Enter now start unchecked

## [0.1.13] - 2026-06-24

### Added
- You can now adjust the window zoom with `⌘=/⌘-/⌘0`

### Changed
- Sidebar folders now reflect real workspace directories, including empty folders, while hiding Hubble-owned config and asset folders

### Fixed
- App title now always shows Hubble instead of the starter template name
- Top bar no longer reserves empty space for the traffic lights in fullscreen

## [0.1.12] - 2026-06-23

### Changed
- New app icon
- Lowercase hubble wordmark on the welcome screen

### Fixed
- Pressing Enter at the end of a link no longer carries the link onto the next line

## [0.1.11] - 2026-06-21

### Added
- HTML Apps: view and run interactive HTML apps directly in the editor
- File APIs so HTML apps can read and write workspace files
- First-run onboarding with an HTML Apps callout
- Hubble now remembers your window size and position between launches
- Web homepage at hubble.md

### Changed
- Refreshed the desktop app icon
- Larger default window size on first launch
- Restyled task list checkboxes

### Fixed
- Slash menu no longer hides behind surrounding UI

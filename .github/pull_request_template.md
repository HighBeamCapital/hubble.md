## PR Template for Standalone Mode Implementation

### What does this PR do?
Implements standalone mode for opening Markdown files directly from the file manager or OS `Open With` dialog.

### Changes Made
- Added `createStandaloneWindow(filePath?: string)` function in Electron main process
- Modified `open-file` event handler to detect standalone file paths
- Added standalone settings persistence (`standalone-settings.json`)
- Created `StandaloneEditor` component for minimal UI
- Added tab management in renderer
- Added IPC handlers for standalone operations

### Files Modified
- `apps/desktop/electron/main.ts` - Added standalone window creation and IPC handlers
- `apps/desktop/src/App.tsx` - Added standalone mode detection and rendering
- `apps/desktop/src/lib/fileActions.ts` - Enhanced file opening logic
- `apps/desktop/src/store/tabs.ts` - Extended tab management for standalone mode
- `apps/desktop/src/renderer/StandaloneEditor.tsx` - New standalone editor component
- `apps/desktop/src/renderer/Tabs.tsx` - Tab component for multiple files
- `apps/desktop/src/renderer/index.html` - Added standalone mode styling
- `apps/desktop/src/preload/preload.mjs` - Updated to expose standalone API
- `docs/plans/desktop-standalone-mode.md` - Documentation for the feature

### Testing
- Added unit tests for standalone window creation
- Added integration tests for tab switching and file persistence
- Verified security constraints for file access outside workspaces

### Checklist
- [ ] All tests pass (`pnpm test`)
- [ ] Code follows existing style guidelines
- [ ] Documentation is updated
- [ ] No breaking changes to existing functionality
- [ ] Security review completed

### Related Issues
- GitHub Issue #1234 (if applicable)
- Documentation issue #5678 (if applicable)
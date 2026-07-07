# Desktop App

Desktop app for Hubble.md (TypeScript + Electron).

## Prerequisites

Install:

- [Node.js](https://nodejs.org/en/download)
- [pnpm](https://pnpm.io/installation)
- macOS desktop builds: Xcode Command Line Tools via `xcode-select --install`

## Development

From repo root:

```sh
pnpm install
pnpm dev:desktop
```

For Chrome DevTools MCP access:

```sh
pnpm dev:desktop:debug
```

The debug command exposes the Electron renderer over Chrome DevTools Protocol at `http://127.0.0.1:${HUBBLE_DESKTOP_DEBUG_PORT:-9222}`.

## Build

From repo root:

```sh
pnpm build:desktop
pnpm bundle:desktop:mac    # macOS (.dmg, .zip)
pnpm bundle:desktop:win    # Windows (NSIS .exe installer)
pnpm bundle:desktop:linux  # Linux (.AppImage, .deb)
```

Each `bundle:desktop:*` command creates release artifacts under `apps/desktop/release/`.
Build a given platform's artifacts on that platform.

## Distribution

Production updates use GitHub Releases on `HighBeamCapital/hubble.md`, built by the
`Desktop Release` workflow when a `desktop-v*` tag is pushed. Artifacts per platform:

- **macOS** — `latest-mac.yml`, the `.zip`, and the `.dmg`
- **Windows** — the NSIS `.exe` installer
- **Linux** — the `.AppImage` and `.deb`

In-app auto-updates are currently macOS-only; Windows and Linux users update by
installing the latest release.


#!/bin/bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SRC_TAURI="$SCRIPT_DIR/src-tauri"
BUILD_DIR="/tmp/hubble-build"

echo "Building frontend..."
cd "$SCRIPT_DIR"
pnpm vite build

echo "Building Rust library..."
cd "$SRC_TAURI"
cargo build --release --target aarch64-apple-ios --lib

echo "Copying library..."
cp "$SRC_TAURI/target/aarch64-apple-ios/release/libhubble.a" \
   "$SRC_TAURI/gen/apple/Externals/arm64/release/libapp.a"

echo "Merging Info.ios.plist (file associations) into generated Info.plist..."
python3 - "$SRC_TAURI/gen/apple/hubble_iOS/Info.plist" "$SRC_TAURI/Info.ios.plist" <<'EOF'
import plistlib
import sys

target_path, overlay_path = sys.argv[1], sys.argv[2]

with open(target_path, "rb") as f:
    target = plistlib.load(f)
with open(overlay_path, "rb") as f:
    overlay = plistlib.load(f)

target.update(overlay)

with open(target_path, "wb") as f:
    plistlib.dump(target, f)
EOF

echo "Finding iPhone..."
# Newer devicectl reports a USB-attached device as "connected"; older ones
# use "available (paired)". Both skip stale pairings ("unavailable").
# `|| true` keeps set -e/pipefail from exiting silently when grep finds nothing.
DEVICE_ID=$(xcrun devicectl list devices 2>/dev/null | grep -i "iphone" | grep -i "physical" | grep -iE "[[:space:]](connected|available \(paired\))[[:space:]]" | grep -oE '[0-9A-F]{8}-[0-9A-F-]{16,}' | head -1 || true)
if [ -z "$DEVICE_ID" ]; then
  echo "No available iPhone found. Connect it via USB, unlock it, and trust this Mac."
  exit 1
fi

DEV_MODE=$(xcrun devicectl device info details --device "$DEVICE_ID" 2>/dev/null | grep -i "Developer Mode Status" || true)
if echo "$DEV_MODE" | grep -qi "disabled"; then
  echo "Developer Mode is off on the iPhone."
  echo "Enable it in Settings > Privacy & Security > Developer Mode, then re-run."
  exit 1
fi

echo "Building Xcode project..."
rm -rf "$BUILD_DIR"
# -destination (not -sdk/-arch) so automatic signing resolves provisioning
# against the actual connected device instead of falling back to a generic
# team-wide profile lookup, which fails with a misleading "no devices" error
# on free-tier Apple ID accounts.
BUILD_LOG="$BUILD_DIR.log"
if ! xcodebuild \
  -project "$SRC_TAURI/gen/apple/hubble.xcodeproj" \
  -scheme hubble_iOS \
  -configuration release \
  -destination "id=$DEVICE_ID" \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=9SHT95CC5X \
  -derivedDataPath "$BUILD_DIR" \
  -allowProvisioningUpdates \
  build \
  >"$BUILD_LOG" 2>&1; then
  # Multi-line errors (e.g. destination lists) lose context under a line grep,
  # so show the tail of the log as well.
  grep -E "error:" "$BUILD_LOG" || true
  echo "--- last 40 lines ---"
  tail -40 "$BUILD_LOG"
  echo "BUILD FAILED. Full log: $BUILD_LOG"
  exit 1
fi
echo "BUILD SUCCEEDED"

echo "Installing on iPhone..."
xcrun devicectl device install app \
  --device "$DEVICE_ID" \
  "$BUILD_DIR/Build/Products/release-iphoneos/Hubble.app"

echo "Done! App installed on iPhone."

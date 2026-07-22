#!/bin/bash
set -e

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

echo "Building Xcode project..."
rm -rf "$BUILD_DIR"
xcodebuild \
  -project "$SRC_TAURI/gen/apple/hubble.xcodeproj" \
  -scheme hubble_iOS \
  -configuration release \
  -sdk iphoneos \
  -arch arm64 \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=9SHT95CC5X \
  -derivedDataPath "$BUILD_DIR" \
  2>&1 | grep -E "(BUILD SUCCEEDED|BUILD FAILED|error:)"

echo "Installing on iPhone..."
DEVICE_ID=$(xcrun devicectl list devices 2>/dev/null | grep -i "iphone" | grep -oE '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}' | head -1)
if [ -z "$DEVICE_ID" ]; then
  echo "No device found. Connect your iPhone via USB."
  exit 1
fi

xcrun devicectl device install app \
  --device "$DEVICE_ID" \
  "$BUILD_DIR/Build/Products/release-iphoneos/Hubble.app"

echo "Done! App installed on iPhone."

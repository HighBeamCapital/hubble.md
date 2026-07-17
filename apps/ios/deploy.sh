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
DEVICE_ID=$(xcrun devicectl list devices 2>/dev/null | grep -oE '[A-F0-9-]{36}' | head -1)
if [ -z "$DEVICE_ID" ]; then
  echo "No device found. Connect your iPhone via USB."
  exit 1
fi

xcrun devicectl device install app \
  --device "$DEVICE_ID" \
  "$BUILD_DIR/Build/Products/release-iphoneos/Hubble.app"

echo "Done! App installed on iPhone."

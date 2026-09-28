#!/bin/bash
set -euo pipefail
LINKDOCK_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -d "$LINKDOCK_DIR/extension" ]; then
  LINKDOCK_SOURCE="$LINKDOCK_DIR/extension"
  LINKDOCK_PROJECTS="$LINKDOCK_DIR/Xcode"
else
  LINKDOCK_SOURCE="$LINKDOCK_DIR/../dist/safari"
  LINKDOCK_PROJECTS="$LINKDOCK_DIR/../local/Xcode"
fi
if [ ! -f "$LINKDOCK_SOURCE/manifest.json" ]; then
  echo 'Erweiterung fehlt. Im Repository zuerst npm run build ausführen.' >&2
  exit 1
fi
if [ -d /Applications/Xcode.app/Contents/Developer ]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi
if ! xcodebuild -version >/dev/null 2>&1; then
  echo 'Vollständiges Xcode installieren und dessen Ersteinrichtung abschließen.' >&2
  exit 1
fi
if xcrun --find safari-web-extension-packager >/dev/null 2>&1; then
  LINKDOCK_PACKAGER=safari-web-extension-packager
elif xcrun --find safari-web-extension-converter >/dev/null 2>&1; then
  LINKDOCK_PACKAGER=safari-web-extension-converter
else
  echo 'Safari Web Extension Packager fehlt in diesem Xcode.' >&2
  exit 1
fi
if [ -e "$LINKDOCK_PROJECTS/LinkDock" ]; then
  printf 'Bestehendes Projekt öffnen: %s/LinkDock/LinkDock.xcodeproj\n' "$LINKDOCK_PROJECTS"
  exit 0
fi
mkdir -p "$LINKDOCK_PROJECTS"
xcrun "$LINKDOCK_PACKAGER" "$LINKDOCK_SOURCE" \
  --project-location "$LINKDOCK_PROJECTS" \
  --app-name LinkDock \
  --bundle-identifier "${LINKDOCK_BUNDLE_ID:-org.example.linkdock}" \
  --swift --macos-only --no-prompt

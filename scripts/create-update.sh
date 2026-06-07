#!/bin/bash
# AzadiPOS Update Package Creator
# Usage: ./scripts/create-update.sh [version] [description]
#
# Creates a .zip update package from the current source that can be
# applied via the admin Settings > Software Update page.
#
# The update package includes all app files EXCEPT:
#   - node_modules, .next, .build (build artifacts)
#   - .env (environment config - never overwritten)
#   - prisma/ (schema changes require manual migration)
#   - .git (version control)
#   - .update-history.json (local history)
#
# Example:
#   ./scripts/create-update.sh 1.1.0 "Bug fixes for receipt printing and reports"

set -e

VERSION=${1:-"1.0.0"}
DESCRIPTION=${2:-"Software update"}
DATE=$(date +%Y%m%d)
OUTPUT_NAME="azadipos-update-v${VERSION}-${DATE}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${PROJECT_DIR}/updates"

echo "=== AzadiPOS Update Package Creator ==="
echo "Version: $VERSION"
echo "Description: $DESCRIPTION"
echo "Output: ${OUTPUT_DIR}/${OUTPUT_NAME}.zip"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Create a temporary staging directory
STAGING=$(mktemp -d)
trap "rm -rf $STAGING" EXIT

echo "Staging update files..."

# Copy app files to staging, excluding what shouldn't be in updates
rsync -a \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.build' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='prisma/' \
  --exclude='.update-history.json' \
  --exclude='.updates/' \
  --exclude='updates/' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='dist/' \
  --exclude='build/' \
  --exclude='out/' \
  --exclude='electron/' \
  --exclude='nextjs_space/' \
  --exclude='server-setup/' \
  --exclude='.github/' \
  "$PROJECT_DIR/" "$STAGING/"

# Create update manifest
cat > "$STAGING/update-manifest.json" << EOF
{
  "version": "$VERSION",
  "description": "$DESCRIPTION",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "sourceDir": ".",
  "compatibleWith": ">=1.0.0"
}
EOF

echo "Creating zip package..."

# Create the zip
cd "$STAGING"
zip -r "${OUTPUT_DIR}/${OUTPUT_NAME}.zip" . -x '*.DS_Store' > /dev/null 2>&1 || {
  # Fallback for Windows
  powershell -Command "Compress-Archive -Path '$STAGING/*' -DestinationPath '${OUTPUT_DIR}/${OUTPUT_NAME}.zip' -Force" 2>/dev/null || {
    echo "ERROR: Could not create zip. Please install 'zip' or use PowerShell."
    exit 1
  }
}

FILE_SIZE=$(du -h "${OUTPUT_DIR}/${OUTPUT_NAME}.zip" | cut -f1)
FILE_COUNT=$(find . -type f | wc -l)

echo ""
echo "=== Update Package Created ==="
echo "File: ${OUTPUT_DIR}/${OUTPUT_NAME}.zip"
echo "Size: $FILE_SIZE"
echo "Files: $FILE_COUNT"
echo ""
echo "To apply this update:"
echo "  1. Copy the .zip file to a USB drive"
echo "  2. On each terminal/server, go to Admin > Settings > Software Update"
echo "  3. Click 'Choose File', select the .zip from the USB drive"
echo "  4. Click 'Apply Update'"
echo "  5. Restart the application"

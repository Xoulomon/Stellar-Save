#!/bin/bash
# Build script for PostgreSQL rotation Lambda function

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAMBDA_DIR="$SCRIPT_DIR/rotation_lambda"
BUILD_DIR="$SCRIPT_DIR/lambda_build"
OUTPUT_ZIP="$SCRIPT_DIR/rotation_lambda.zip"

echo "Building Lambda rotation function..."

# Clean previous build
rm -rf "$BUILD_DIR"
rm -f "$OUTPUT_ZIP"

# Create build directory
mkdir -p "$BUILD_DIR"

# Install dependencies
echo "Installing Python dependencies..."
pip install -r "$LAMBDA_DIR/requirements.txt" -t "$BUILD_DIR" --quiet

# Copy Lambda function
cp "$LAMBDA_DIR/index.py" "$BUILD_DIR/"

# Create ZIP archive
echo "Creating deployment package..."
cd "$BUILD_DIR"
zip -r "$OUTPUT_ZIP" . -q

# Cleanup
cd "$SCRIPT_DIR"
rm -rf "$BUILD_DIR"

echo "Lambda package created: $OUTPUT_ZIP"
echo "Size: $(du -h "$OUTPUT_ZIP" | cut -f1)"

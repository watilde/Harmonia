#!/bin/bash
##############################################################################
# Quick Test - Module 1 Only with 1K Dataset
# 
# Fast test to verify the research pipeline is working (~5 minutes)
##############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "  [QUICK] Quick Test - Module 1 (Manski Bounds)"
echo "=========================================="
echo ""

# Build
echo " Building CLI and Core..."
cd "$PROJECT_ROOT"
npm run build -w @harmonia/cli
npm run build -w @harmonia/core
echo "SUCCESS: Build complete"
echo ""

# Download 1K dataset
echo " Downloading 1K dataset..."
cd "$SCRIPT_DIR"
npm run data:download:1k
echo "SUCCESS: Data download complete"
echo ""

# Run Module 1 - Manski Bounds
echo " Running Module 1: Manski Bounds..."
cd "$SCRIPT_DIR/cli-workflows"
./1-manski-bounds.sh
echo "SUCCESS: Experiment complete"
echo ""

# Generate PDF
echo " Generating PDF report..."
cd "$SCRIPT_DIR/modules/1-manski-bounds"
npm run paper:pdf
echo "SUCCESS: PDF generated"
echo ""

echo "=========================================="
echo "  SUCCESS: Quick Test Complete!"
echo "=========================================="
echo ""
echo " Results:"
echo "  - Workflow output: $SCRIPT_DIR/cli-workflows/output/manski-bounds/"
echo "  - PDF report: $SCRIPT_DIR/modules/1-manski-bounds/manuscripts/manuscript_v6.0.pdf"
echo ""
echo " Next steps:"
echo "  - Run full test: ./research/test-all-research.sh"
echo "  - Check results: cat $SCRIPT_DIR/cli-workflows/output/manski-bounds/summary.md"
echo ""

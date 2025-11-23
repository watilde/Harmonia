#!/bin/bash
##############################################################################
# Generate PDF from Manuscript
# 
# Converts the manuscript Markdown file to PDF using marked and puppeteer
##############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE_DIR="$(dirname "$SCRIPT_DIR")"
MANUSCRIPT_DIR="$MODULE_DIR/manuscripts"

echo "=========================================="
echo "  Generating PDF from Manuscript"
echo "=========================================="
echo ""

# Find the manuscript file
MANUSCRIPT_FILE=$(find "$MANUSCRIPT_DIR" -maxdepth 1 -name "manuscript_v*.md" | sort -V | tail -1)

if [ -z "$MANUSCRIPT_FILE" ]; then
  echo "ERROR: No manuscript file found in $MANUSCRIPT_DIR"
  exit 1
fi

MANUSCRIPT_NAME=$(basename "$MANUSCRIPT_FILE" .md)
OUTPUT_PDF="$MANUSCRIPT_DIR/${MANUSCRIPT_NAME}.pdf"

echo "  Source: $(basename "$MANUSCRIPT_FILE")"
echo "  Output: $(basename "$OUTPUT_PDF")"
echo ""

# Use Node.js script to generate PDF
node "$SCRIPT_DIR/generate-pdf.js" "$MANUSCRIPT_FILE" "$OUTPUT_PDF"

if [ -f "$OUTPUT_PDF" ]; then
  echo ""
  echo "SUCCESS: PDF generated successfully: $OUTPUT_PDF"
else
  echo "ERROR: PDF was not generated"
  exit 1
fi

echo ""
echo "=========================================="
echo "  PDF Generation Complete"
echo "=========================================="

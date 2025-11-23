#!/bin/bash
##############################################################################
# Complete Research Module Test Script
# 
# Downloads all datasets and runs all research module experiments
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "   Harmonia Research - Complete Test Suite"
echo "=========================================="
echo ""

##############################################################################
# Step 0: Build Prerequisites
##############################################################################
echo -e "${BLUE} Step 0: Building CLI and Core packages...${NC}"
cd "$PROJECT_ROOT"
npm run build -w @harmonia/cli
npm run build -w @harmonia/core
echo -e "${GREEN}SUCCESS: Build complete${NC}"
echo ""

##############################################################################
# Step 1: Data Download
##############################################################################
echo -e "${BLUE} Step 1: Data Download${NC}"
echo ""

cd "$SCRIPT_DIR"

# Ask user which datasets to download
echo "Which datasets do you want to download?"
echo "  1) 1K only (quick test, ~2 min)"
echo "  2) 1K + 100K (medium test, ~30 min)"
echo "  3) 1K + 100K + 2.8M (full test, ~8 hours)"
echo "  4) 1K + MIMIC (mixed synthetic/real, ~7 min)"
echo "  5) All datasets (complete, ~8+ hours)"
echo "  6) Skip download (use existing data)"
echo ""
read -p "Enter choice (1-6): " DATASET_CHOICE

case $DATASET_CHOICE in
  1)
    echo -e "${YELLOW}Downloading 1K dataset...${NC}"
    npm run data:download:1k
    ;;
  2)
    echo -e "${YELLOW}Downloading 1K and 100K datasets...${NC}"
    npm run data:download:1k
    npm run data:download:100k
    ;;
  3)
    echo -e "${YELLOW}Downloading 1K, 100K, and 2.8M datasets...${NC}"
    npm run data:download:1k
    npm run data:download:100k
    npm run data:download:2.8m
    ;;
  4)
    echo -e "${YELLOW}Downloading 1K and MIMIC datasets...${NC}"
    npm run data:download:1k
    npm run data:download:mimic
    ;;
  5)
    echo -e "${YELLOW}Downloading all datasets...${NC}"
    npm run data:download:1k
    npm run data:download:100k
    npm run data:download:2.8m
    npm run data:download:mimic
    ;;
  6)
    echo -e "${YELLOW}Skipping data download${NC}"
    ;;
  *)
    echo -e "${RED}Invalid choice, defaulting to 1K only${NC}"
    npm run data:download:1k
    ;;
esac

echo -e "${GREEN}SUCCESS: Data download complete${NC}"
echo ""

##############################################################################
# Step 2: CLI Workflows Execution
##############################################################################
echo -e "${BLUE} Step 2: Running CLI Workflows${NC}"
echo ""

cd "$SCRIPT_DIR/cli-workflows"

# Module 1: Manski Bounds
echo -e "${YELLOW}Running Module 1: Manski Bounds...${NC}"
./1-manski-bounds.sh
echo -e "${GREEN}SUCCESS: Module 1 complete${NC}"
echo ""

# Module 2: Federated Partial Identification
echo -e "${YELLOW}Running Module 2: Federated Partial Identification...${NC}"
./2-federated-partial-identification.sh
echo -e "${GREEN}SUCCESS: Module 2 complete${NC}"
echo ""

# Module 3: Federated E-values
echo -e "${YELLOW}Running Module 3: Federated E-values...${NC}"
./3-federated-evalues.sh
echo -e "${GREEN}SUCCESS: Module 3 complete${NC}"
echo ""

# Module 4: Design-Failure-Aware
echo -e "${YELLOW}Running Module 4: Design-Failure-Aware Causal...${NC}"
./4-design-failure-aware-causal.sh
echo -e "${GREEN}SUCCESS: Module 4 complete${NC}"
echo ""

# Module 5: Integrated Framework
echo -e "${YELLOW}Running Module 5: Identification-Sensitivity-Adaptation...${NC}"
./5-identification-sensitivity-adaptation.sh
echo -e "${GREEN}SUCCESS: Module 5 complete${NC}"
echo ""

##############################################################################
# Step 3: PDF Generation
##############################################################################
echo -e "${BLUE} Step 3: Generating PDF Reports${NC}"
echo ""

# Module 1
echo -e "${YELLOW}Generating PDF for Module 1...${NC}"
cd "$SCRIPT_DIR/modules/1-manski-bounds"
npm run paper:pdf
echo -e "${GREEN}SUCCESS: Module 1 PDF generated${NC}"

# Module 2
echo -e "${YELLOW}Generating PDF for Module 2...${NC}"
cd "$SCRIPT_DIR/modules/2-federated-partial-identification"
npm run paper:pdf
echo -e "${GREEN}SUCCESS: Module 2 PDF generated${NC}"

# Module 3
echo -e "${YELLOW}Generating PDF for Module 3...${NC}"
cd "$SCRIPT_DIR/modules/3-federated-evalues"
npm run paper:pdf
echo -e "${GREEN}SUCCESS: Module 3 PDF generated${NC}"

# Module 4
echo -e "${YELLOW}Generating PDF for Module 4...${NC}"
cd "$SCRIPT_DIR/modules/4-design-failure-aware-causal"
npm run paper:pdf
echo -e "${GREEN}SUCCESS: Module 4 PDF generated${NC}"

# Module 5
echo -e "${YELLOW}Generating PDF for Module 5...${NC}"
cd "$SCRIPT_DIR/modules/5-identification-sensitivity-adaptation"
npm run paper:pdf
echo -e "${GREEN}SUCCESS: Module 5 PDF generated${NC}"

echo ""

##############################################################################
# Summary
##############################################################################
echo "=========================================="
echo -e "  ${GREEN}SUCCESS: All Tests Complete!${NC}"
echo "=========================================="
echo ""
echo -e "${BLUE} Results Location:${NC}"
echo "  - CLI workflows: $SCRIPT_DIR/cli-workflows/output/"
echo "  - Module experiments: $SCRIPT_DIR/modules/*/experiments/output/"
echo "  - PDF reports: $SCRIPT_DIR/modules/*/manuscripts/*.pdf"
echo ""
echo -e "${BLUE} Summary Reports:${NC}"
echo "  - Module 1: $SCRIPT_DIR/cli-workflows/output/manski-bounds/summary.md"
echo "  - Module 2: $SCRIPT_DIR/cli-workflows/output/federated-partial-id/summary.md"
echo "  - Module 3: $SCRIPT_DIR/cli-workflows/output/federated-evalues/summary.md"
echo "  - Module 4: $SCRIPT_DIR/cli-workflows/output/design-failure-aware/summary.md"
echo "  - Module 5: $SCRIPT_DIR/cli-workflows/output/identification-sensitivity-adaptation/summary.md"
echo ""
echo -e "${BLUE} View Results:${NC}"
echo "  tree -L 3 $SCRIPT_DIR/cli-workflows/output/"
echo "  ls -lh $SCRIPT_DIR/modules/*/manuscripts/*.pdf"
echo ""

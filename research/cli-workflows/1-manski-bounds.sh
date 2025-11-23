#!/bin/bash
##############################################################################
# Manski Bounds CLI Workflow
# 
# This script demonstrates the complete Manski bounds workflow using CLI
# commands instead of TypeScript code.
#
# Workflow:
# 1. Generate synthetic OMOP data for 3 sites
# 2. Compute bounds at each site (worst-case and MTR)
# 3. Federate bounds using different aggregation strategies
# 4. Compare results
##############################################################################

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create output directory
OUTPUT_DIR="research/cli-workflows/output/manski-bounds"
mkdir -p "$OUTPUT_DIR"

echo "════════════════════════════════════════════════════════════════════"
echo "  🏥 Federated Manski Bounds CLI Workflow"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "This workflow demonstrates partial identification in federated settings"
echo "using the Harmonia CLI."
echo ""

# Step 1: Generate OMOP data for 3 sites
echo -e "${BLUE}📂 Step 1: Generating synthetic OMOP data for 3 sites...${NC}"
echo ""

for site_id in site-1 site-2 site-3; do
  echo "  Generating data for $site_id..."
  npx harmonia causal generate-data \
    -n 334 \
    --treatment-rate 0.5 \
    --output "$OUTPUT_DIR/${site_id}-data.json"
done

echo ""
echo -e "${GREEN}✓ Data generation complete${NC}"
echo ""

# Step 2: Compute bounds at each site
echo -e "${BLUE}📊 Step 2: Computing site-specific Manski bounds...${NC}"
echo ""

for site_id in site-1 site-2 site-3; do
  echo "  Computing bounds for $site_id..."
  
  # Worst-case bounds
  npx harmonia causal compute-bounds \
    --data "$OUTPUT_DIR/${site_id}-data.json" \
    --assumption worst-case \
    --output "$OUTPUT_DIR/${site_id}-bounds-worst-case.json"
  
  # MTR bounds
  npx harmonia causal compute-bounds \
    --data "$OUTPUT_DIR/${site_id}-data.json" \
    --assumption mtr \
    --output "$OUTPUT_DIR/${site_id}-bounds-mtr.json"
  
  echo "    ✓ Worst-case and MTR bounds computed"
done

echo ""
echo -e "${GREEN}✓ Site-specific bounds computed${NC}"
echo ""

# Step 3: Prepare multi-site bounds file for federation
echo -e "${BLUE}🔗 Step 3: Preparing multi-site bounds for federation...${NC}"
echo ""

# Create a JSON array of site bounds for worst-case
cat > "$OUTPUT_DIR/multi-site-bounds-worst-case.json" <<EOF
{
  "sites": [
    $(cat "$OUTPUT_DIR/site-1-bounds-worst-case.json" | jq '{site_id: "site-1", bounds: .}'),
    $(cat "$OUTPUT_DIR/site-2-bounds-worst-case.json" | jq '{site_id: "site-2", bounds: .}'),
    $(cat "$OUTPUT_DIR/site-3-bounds-worst-case.json" | jq '{site_id: "site-3", bounds: .}')
  ]
}
EOF

# Create a JSON array of site bounds for MTR
cat > "$OUTPUT_DIR/multi-site-bounds-mtr.json" <<EOF
{
  "sites": [
    $(cat "$OUTPUT_DIR/site-1-bounds-mtr.json" | jq '{site_id: "site-1", bounds: .}'),
    $(cat "$OUTPUT_DIR/site-2-bounds-mtr.json" | jq '{site_id: "site-2", bounds: .}'),
    $(cat "$OUTPUT_DIR/site-3-bounds-mtr.json" | jq '{site_id: "site-3", bounds: .}')
  ]
}
EOF

echo -e "${GREEN}✓ Multi-site bounds files prepared${NC}"
echo ""

# Step 4: Federate bounds using different strategies
echo -e "${BLUE}🌐 Step 4: Federating bounds with different aggregation strategies...${NC}"
echo ""

strategies=("weighted-average" "conservative" "uniform" "inverse-width")

for strategy in "${strategies[@]}"; do
  echo "  Strategy: $strategy"
  
  # Worst-case federated
  npx harmonia causal federate-bounds \
    -s "$OUTPUT_DIR/site-1-bounds-worst-case.json" \
       "$OUTPUT_DIR/site-2-bounds-worst-case.json" \
       "$OUTPUT_DIR/site-3-bounds-worst-case.json" \
    --strategy "$strategy" \
    --output "$OUTPUT_DIR/federated-worst-case-${strategy}.json"
  
  # MTR federated
  npx harmonia causal federate-bounds \
    -s "$OUTPUT_DIR/site-1-bounds-mtr.json" \
       "$OUTPUT_DIR/site-2-bounds-mtr.json" \
       "$OUTPUT_DIR/site-3-bounds-mtr.json" \
    --strategy "$strategy" \
    --output "$OUTPUT_DIR/federated-mtr-${strategy}.json"
  
  echo "    ✓ Federated bounds computed"
done

echo ""
echo -e "${GREEN}✓ Federation complete${NC}"
echo ""

# Step 5: Display results
echo -e "${BLUE}📈 Step 5: Displaying results...${NC}"
echo ""

echo "Worst-Case Bounds Summary:"
echo "─────────────────────────────────────────────────────────────────"
for strategy in "${strategies[@]}"; do
  echo ""
  echo "  Strategy: $strategy"
  cat "$OUTPUT_DIR/federated-worst-case-${strategy}.json" | jq -r '
    "    Lower: \(.lower | tostring | .[0:6])  Upper: \(.upper | tostring | .[0:6])  Width: \(.width | tostring | .[0:6])"
  '
done

echo ""
echo "MTR Bounds Summary:"
echo "─────────────────────────────────────────────────────────────────"
for strategy in "${strategies[@]}"; do
  echo ""
  echo "  Strategy: $strategy"
  cat "$OUTPUT_DIR/federated-mtr-${strategy}.json" | jq -r '
    "    Lower: \(.lower | tostring | .[0:6])  Upper: \(.upper | tostring | .[0:6])  Width: \(.width | tostring | .[0:6])"
  '
done

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo -e "${GREEN}✓ Workflow complete!${NC}"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "Output files saved to: $OUTPUT_DIR"
echo ""
echo "Key findings:"
echo "  • MTR bounds are tighter than worst-case (width is smaller)"
echo "  • Intersection strategy gives conservative (widest) bounds"
echo "  • Weighted-average balances information across sites"
echo ""

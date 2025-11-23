#!/bin/bash
##############################################################################
# Federated E-values Workflow
# 
# Demonstrates Federated Robustness Index (FRI) for multi-site sensitivity
# analysis. Based on research paper: "Federated E-values and Robustness Index
# for Multi-Site Causal Inference"
#
# Workflow:
# 1. Generate data for multiple sites
# 2. Compute bounds and E-values at each site
# 3. Calculate Federated Robustness Index (FRI)
# 4. Compare FRI aggregation strategies
# 5. Assess robustness levels across network
##############################################################################

set -e  # Exit on error

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Import shared functions
source "$SCRIPT_DIR/utils/shared-functions.sh"

# Create output directory
OUTPUT_DIR="$SCRIPT_DIR/output/federated-evalues"
DATA_DIR="$OUTPUT_DIR/data"
mkdir -p "$OUTPUT_DIR" "$DATA_DIR"

echo "════════════════════════════════════════════════════════════════════"
echo "  🛡️  Federated E-values & Robustness Index Workflow"
echo "════════════════════════════════════════════════════════════════════"
echo ""

##############################################################################
# Step 1: Generate Multi-Site Data
##############################################################################
print_section_header "Step 1: Generate Multi-Site Data"

echo "  Generating data for 5 sites (hospital network)..."
sizes=(800 650 220 180 90)
site_names=("mass-general" "johns-hopkins" "community-a" "community-b" "rural")

for i in "${!sizes[@]}"; do
  site_id="${site_names[$i]}"
  n="${sizes[$i]}"
  echo "    Generating $site_id (n=$n)..."
  generate_site_data "$site_id" "$n" 0.5 "$DATA_DIR/${site_id}-data.json"
done

print_success "Data generated for 5 sites"
echo ""

##############################################################################
# Step 2: Compute Bounds and E-values
##############################################################################
print_section_header "Step 2: Compute Bounds and E-values"

echo "  Computing MTR bounds at each site..."
for site in "${site_names[@]}"; do
  compute_site_bounds \
    "$DATA_DIR/${site}-data.json" \
    "$DATA_DIR/${site}-bounds.json" \
    "mtr"
done
print_success "Bounds computed"
echo ""

echo "  Computing E-values from bounds..."
for site in "${site_names[@]}"; do
  compute_evalue_from_bounds \
    "$DATA_DIR/${site}-bounds.json" \
    0.3 \
    "$DATA_DIR/${site}-evalue.json"
done
print_success "E-values computed"
echo ""

##############################################################################
# Step 3: Display Site-Specific E-values
##############################################################################
print_section_header "Step 3: Site-Specific E-values"

echo -e "${BLUE}E-values by site:${NC}"
for site in "${site_names[@]}"; do
  evalue=$(jq -r '.conservative.evalue' "$DATA_DIR/${site}-evalue.json")
  robustness=$(jq -r '.conservative.robustness_level' "$DATA_DIR/${site}-evalue.json")
  printf "    %-20s → E-value=%.2f (%s)\n" "$site" "$evalue" "$robustness"
done
echo ""

##############################################################################
# Step 4: Create Multi-Site JSON for FRI
##############################################################################
print_section_header "Step 4: Compute Federated Robustness Index"

# Create multi-site evalues JSON in the format expected by compute-fri
echo "[" > "$DATA_DIR/multi-site-evalues.json"

first=true
for site in "${site_names[@]}"; do
  if [[ "$first" == false ]]; then
    echo "  ," >> "$DATA_DIR/multi-site-evalues.json"
  fi
  first=false
  
  # Extract E-value (conservative), sample size from bounds, and robustness level
  evalue=$(jq -r '.conservative.evalue' "$DATA_DIR/${site}-evalue.json")
  robustness=$(jq -r '.conservative.robustness_level' "$DATA_DIR/${site}-evalue.json")
  interpretation=$(jq -r '.conservative.interpretation' "$DATA_DIR/${site}-evalue.json")
  sample_size=$(jq -r '.sampleSize' "$DATA_DIR/${site}-bounds.json")
  
  # Create SiteEvalue object
  cat >> "$DATA_DIR/multi-site-evalues.json" <<EOF
  {
    "site_id": "$site",
    "evalue": $evalue,
    "sample_size": $sample_size,
    "robustness_level": "$robustness",
    "interpretation": "$interpretation"
  }
EOF
done

echo "" >> "$DATA_DIR/multi-site-evalues.json"
echo "]" >> "$DATA_DIR/multi-site-evalues.json"

echo "  Comparing FRI aggregation strategies..."
compare_fri_strategies "$DATA_DIR/multi-site-evalues.json" "$OUTPUT_DIR" "network"

print_success "FRI computed with multiple strategies"
echo ""

##############################################################################
# Step 5: Network Robustness Assessment
##############################################################################
print_section_header "Step 5: Network Robustness Assessment"

# Compute FRI with sample-size weighting (recommended)
compute_fri "$DATA_DIR/multi-site-evalues.json" "sample-size" "$OUTPUT_DIR/network-fri.json"

min_evalue=$(jq -r '.fri.min_evalue' "$OUTPUT_DIR/network-fri.json")
median_evalue=$(jq -r '.fri.median_evalue' "$OUTPUT_DIR/network-fri.json")
weighted_avg=$(jq -r '.fri.weighted_avg_evalue' "$OUTPUT_DIR/network-fri.json")
overall_robustness=$(jq -r '.fri.overall_robustness' "$OUTPUT_DIR/network-fri.json")
interpretation=$(jq -r '.fri.interpretation' "$OUTPUT_DIR/network-fri.json")

echo -e "${BLUE}Network-wide assessment:${NC}"
echo "    Minimum E-value:     $min_evalue"
echo "    Median E-value:      $median_evalue"
echo "    Weighted Average:    $weighted_avg"
echo "    Overall Robustness:  $overall_robustness"
echo "    Interpretation:      $interpretation"
echo ""

# Count sites by robustness level
robust_count=0
moderate_count=0
weak_count=0

for site in "${site_names[@]}"; do
  robustness=$(jq -r '.conservative.robustness_level' "$DATA_DIR/${site}-evalue.json")
  case "$robustness" in
    "strong"|"robust") robust_count=$((robust_count + 1)) ;;
    "good") robust_count=$((robust_count + 1)) ;;
    "moderate") moderate_count=$((moderate_count + 1)) ;;
    *) weak_count=$((weak_count + 1)) ;;
  esac
done

echo "    Sites by robustness:"
echo "      Strong/Robust: $robust_count"
echo "      Moderate: $moderate_count"
echo "      Weak/Vulnerable: $weak_count"
echo ""

##############################################################################
# Summary
##############################################################################
print_section_header "Summary"

echo "  Results saved to: $OUTPUT_DIR"
echo ""
echo "  Key findings:"
echo "    • Network-wide robustness: $overall_robustness"
echo "    • Weighted Average E-value: $weighted_avg"
echo "    • Large sites show stronger robustness"
echo "    • Small sites require careful interpretation"
echo "    • FRI aggregates evidence across heterogeneous sites"
echo ""
echo -e "${GREEN}✓ Federated E-values Workflow Complete${NC}"
echo ""

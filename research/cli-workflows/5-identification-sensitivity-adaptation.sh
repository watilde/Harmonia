#!/bin/bash
##############################################################################
# Identification-Sensitivity-Adaptation Complete Pipeline Workflow
# 
# Comprehensive hierarchical federated causal inference pipeline integrating
# all three research modules:
# 1. Identification: Federated Partial Identification (optimal weighting)
# 2. Sensitivity: Federated E-values & Robustness Index
# 3. Adaptation: Design-Failure-Aware Causal Inference (automatic adaptation)
#
# This workflow demonstrates the complete hierarchical framework for privacy-preserving
# multi-site causal inference with automatic assumption violation detection.
##############################################################################

set -e  # Exit on error

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Import shared functions
source "$SCRIPT_DIR/utils/shared-functions.sh"

# Create output directory
OUTPUT_DIR="$SCRIPT_DIR/output/identification-sensitivity-adaptation"
DATA_DIR="$OUTPUT_DIR/data"
mkdir -p "$OUTPUT_DIR" "$DATA_DIR"

echo "════════════════════════════════════════════════════════════════════"
echo "  🚀 Hierarchical Framework Pipeline - Identification-Sensitivity-Adaptation"
echo "════════════════════════════════════════════════════════════════════"
echo ""

##############################################################################
# MODULE 0: Generate Multi-Site Network Data
##############################################################################
print_section_header "Module 0: Generate Hospital Network Data"

echo "  Simulating 4-hospital anticoagulation study..."
sites=("stanford" "community" "rural" "va")
sizes=(1200 450 180 820)

for i in "${!sites[@]}"; do
  site="${sites[$i]}"
  n="${sizes[$i]}"
  echo "    Generating $site (n=$n)..."
  generate_site_data "$site" "$n" 0.5 "$DATA_DIR/${site}-data.json"
done

print_success "Network data generated"
echo ""

##############################################################################
# MODULE 3: Design-Failure-Aware - Assumption Diagnostics
##############################################################################
print_section_header "Module 3: Assumption Diagnostics"

echo "  Running diagnostic tests at each site..."
for site in "${sites[@]}"; do
  diagnose_site_assumptions \
    "$DATA_DIR/${site}-data.json" \
    "$DATA_DIR/${site}-diagnostics.json"
done
print_success "Diagnostics complete"
echo ""

echo -e "${BLUE}Diagnostic scores by site:${NC}"
for site in "${sites[@]}"; do
  display_assumption_scores "$DATA_DIR/${site}-diagnostics.json" "$site"
done
echo ""

##############################################################################
# MODULE 3: Automatic Inference Mode Selection
##############################################################################
print_section_header "Module 3: Automatic Mode Selection"

echo "  Selecting inference mode for each site..."
for site in "${sites[@]}"; do
  select_site_mode \
    "$DATA_DIR/${site}-diagnostics.json" \
    "$DATA_DIR/${site}-mode.json"
done
print_success "Modes selected"
echo ""

echo -e "${BLUE}Selected modes by site:${NC}"
for site in "${sites[@]}"; do
  display_selected_mode "$DATA_DIR/${site}-mode.json" "$site"
done
echo ""

##############################################################################
# MODULE 1: Federated Partial Identification - Compute Bounds
##############################################################################
print_section_header "Module 1: Partial Identification (Bounds)"

echo "  Computing MTR bounds at each site..."
for site in "${sites[@]}"; do
  mode=$(jq -r '.mode' "$DATA_DIR/${site}-mode.json")
  
  if [[ "$mode" == "bounds" || "$mode" == "mixed" || "$mode" == "sensitivity" ]]; then
    compute_site_bounds \
      "$DATA_DIR/${site}-data.json" \
      "$DATA_DIR/${site}-bounds.json" \
      "mtr"
  else
    # For point estimate mode, still compute bounds for comparison
    compute_site_bounds \
      "$DATA_DIR/${site}-data.json" \
      "$DATA_DIR/${site}-bounds.json" \
      "mtr"
  fi
done
print_success "Bounds computed"
echo ""

echo -e "${BLUE}Site-specific bounds:${NC}"
for site in "${sites[@]}"; do
  lower=$(jq -r '.lower' "$DATA_DIR/${site}-bounds.json")
  upper=$(jq -r '.upper' "$DATA_DIR/${site}-bounds.json")
  width=$(jq -r '.width' "$DATA_DIR/${site}-bounds.json")
  printf "    %-15s → [%.4f, %.4f] (width=%.4f)\n" "$site" "$lower" "$upper" "$width"
done
echo ""

##############################################################################
# MODULE 1: Federated Aggregation with Multiple Strategies
##############################################################################
print_section_header "Module 1: Federated Aggregation"

echo -e "${BLUE}Comparing aggregation strategies:${NC}"

# Build array of bounds files
bounds_files=()
for site in "${sites[@]}"; do
  bounds_files+=("$DATA_DIR/${site}-bounds.json")
done

compare_aggregation_strategies "$OUTPUT_DIR" "federated" "${bounds_files[@]}"

print_success "Federated bounds computed"
echo ""

##############################################################################
# MODULE 2: E-values and Federated Robustness Index
##############################################################################
print_section_header "Module 2: Federated Robustness Index"

echo "  Computing E-values from bounds..."
for site in "${sites[@]}"; do
  compute_evalue_from_bounds \
    "$DATA_DIR/${site}-bounds.json" \
    0.3 \
    "$DATA_DIR/${site}-evalue.json"
done
print_success "E-values computed"
echo ""

echo -e "${BLUE}E-values by site:${NC}"
for site in "${sites[@]}"; do
  evalue=$(jq -r '.evalue' "$DATA_DIR/${site}-evalue.json")
  robustness=$(jq -r '.robustness_level' "$DATA_DIR/${site}-evalue.json")
  printf "    %-15s → E-value=%.2f (%s)\n" "$site" "$evalue" "$robustness"
done
echo ""

# Create multi-site evalues JSON
echo "{" > "$DATA_DIR/multi-site-evalues.json"
echo '  "sites": [' >> "$DATA_DIR/multi-site-evalues.json"

first=true
for site in "${sites[@]}"; do
  if [[ "$first" == false ]]; then
    echo "    ," >> "$DATA_DIR/multi-site-evalues.json"
  fi
  first=false
  
  echo "    {" >> "$DATA_DIR/multi-site-evalues.json"
  echo "      \"site_id\": \"$site\"," >> "$DATA_DIR/multi-site-evalues.json"
  echo -n "      \"data\": " >> "$DATA_DIR/multi-site-evalues.json"
  cat "$DATA_DIR/${site}-evalue.json" >> "$DATA_DIR/multi-site-evalues.json"
  echo "" >> "$DATA_DIR/multi-site-evalues.json"
  echo -n "    }" >> "$DATA_DIR/multi-site-evalues.json"
done

echo "" >> "$DATA_DIR/multi-site-evalues.json"
echo "  ]" >> "$DATA_DIR/multi-site-evalues.json"
echo "}" >> "$DATA_DIR/multi-site-evalues.json"

echo "  Computing Federated Robustness Index..."
compute_fri "$DATA_DIR/multi-site-evalues.json" "sample-size" "$OUTPUT_DIR/network-fri.json"

fri=$(jq -r '.federated_robustness_index' "$OUTPUT_DIR/network-fri.json")
interpretation=$(jq -r '.interpretation' "$OUTPUT_DIR/network-fri.json")

echo -e "${BLUE}Network FRI:${NC}"
echo "    FRI: $fri"
echo "    Interpretation: $interpretation"
echo ""

print_success "FRI computed"
echo ""

##############################################################################
# INTEGRATION: Adaptive Decision Making
##############################################################################
print_section_header "Integration: Adaptive Network-Wide Decision"

echo -e "${BLUE}Network-wide assessment:${NC}"

# Count sites by mode
point_count=0
bounds_count=0
mixed_count=0
sensitivity_count=0

for site in "${sites[@]}"; do
  mode=$(jq -r '.mode' "$DATA_DIR/${site}-mode.json")
  case "$mode" in
    "point") ((point_count++)) ;;
    "bounds") ((bounds_count++)) ;;
    "mixed") ((mixed_count++)) ;;
    "sensitivity") ((sensitivity_count++)) ;;
  esac
done

echo "    Sites by inference mode:"
echo "      Point estimate: $point_count"
echo "      Partial ID (bounds): $bounds_count"
echo "      Mixed: $mixed_count"
echo "      Sensitivity: $sensitivity_count"
echo ""

# Recommended federated strategy based on mode distribution
if [[ $point_count -ge 3 ]]; then
  strategy="weighted-average"
  reason="Most sites support point estimation"
elif [[ $bounds_count -ge 2 ]]; then
  strategy="inverse-width"
  reason="Multiple sites require partial identification"
else
  strategy="conservative"
  reason="Mixed quality requires conservative approach"
fi

echo "    Recommended federated strategy: $strategy"
echo "    Reason: $reason"
echo ""

# Get federated result with recommended strategy
fed_lower=$(jq -r '.lower' "$OUTPUT_DIR/federated_${strategy}.json")
fed_upper=$(jq -r '.upper' "$OUTPUT_DIR/federated_${strategy}.json")
fed_width=$(jq -r '.width' "$OUTPUT_DIR/federated_${strategy}.json")

echo "    Network-wide causal estimate:"
echo "      ATE ∈ [$fed_lower, $fed_upper]"
echo "      Width: $fed_width"
echo "      FRI: $fri ($interpretation)"
echo ""

##############################################################################
# Summary Report
##############################################################################
print_section_header "Hierarchical Framework Pipeline Summary"

cat > "$OUTPUT_DIR/summary.md" << EOF
# Hierarchical Framework Pipeline - Summary Report

## Network Configuration
- **Sites**: ${#sites[@]} hospitals
- **Total patients**: $(( ${sizes[0]} + ${sizes[1]} + ${sizes[2]} + ${sizes[3]} ))
- **Study**: Anticoagulation treatment effectiveness

## Module 3: Design-Failure-Aware Results
- Point estimate sites: $point_count
- Bounds-only sites: $bounds_count
- Mixed mode sites: $mixed_count
- Sensitivity-only sites: $sensitivity_count

## Module 1: Federated Partial Identification
- Recommended strategy: $strategy
- Federated ATE bounds: [$fed_lower, $fed_upper]
- Bound width: $fed_width

## Module 2: Federated Robustness Assessment
- Network FRI: $fri
- Interpretation: $interpretation
- Sites with strong robustness: $(jq '[.sites[].data | select(.robustness_level == "strong" or .robustness_level == "robust")] | length' "$DATA_DIR/multi-site-evalues.json")

## Integrated Conclusion
The hierarchical framework successfully:
1. **Identification**: Aggregated evidence using optimal weighting (Module 1)
2. **Sensitivity**: Assessed network-wide robustness to unmeasured confounding (Module 2)
3. **Adaptation**: Detected assumption violations and adapted inference strategy automatically (Module 3)

**Recommendation**: $reason
Use $strategy aggregation with network FRI of $fri.
EOF

echo "  Full report saved to: $OUTPUT_DIR/summary.md"
echo ""
echo -e "${GREEN}✓ Hierarchical Framework Pipeline Finished Successfully${NC}"
echo ""
echo "  All results in: $OUTPUT_DIR"
echo ""

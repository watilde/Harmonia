#!/usr/bin/env bash
##############################################################################
# FRCI Shared Functions Library
# 
# Common functions used across all three FRCI paper experiments.
# This library reduces code duplication and provides consistent patterns.
##############################################################################

# Colors for output
export GREEN='\033[0;32m'
export BLUE='\033[0;34m'
export CYAN='\033[0;36m'
export YELLOW='\033[1;33m'
export RED='\033[0;31m'
export NC='\033[0m'

# Get the project root and CLI path
SHARED_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SHARED_SCRIPT_DIR/../../.." && pwd)"
CLI_PATH="$PROJECT_ROOT/packages/cli/dist/cli.js"

# Verify CLI exists
if [ ! -f "$CLI_PATH" ]; then
  echo "ERROR: Harmonia CLI not found at $CLI_PATH"
  echo "Please run 'npm run build -w @harmonia/cli' first"
  exit 1
fi

# Suppress TensorFlow warnings
export TF_CPP_MIN_LOG_LEVEL=3
export TF_ENABLE_ONEDNN_OPTS=0

# Suppress TensorFlow warnings
export TF_CPP_MIN_LOG_LEVEL=3
export TF_ENABLE_ONEDNN_OPTS=0

##############################################################################
# Data Generation Functions
##############################################################################

# Generate synthetic data for a single site
# Usage: generate_site_data <site_id> <n_patients> <treatment_rate> <output_file>
generate_site_data() {
  local site_id="$1"
  local n_patients="$2"
  local treatment_rate="${3:-0.5}"
  local output_file="$4"
  
  node "$CLI_PATH" causal generate-data \
    -n "$n_patients" \
    --treatment-rate "$treatment_rate" \
    --output "$output_file" \
    > /dev/null 2>&1
}

# Generate data for multiple sites with same size
# Usage: generate_balanced_sites <n_per_site> <output_dir> <site_prefix> <num_sites>
generate_balanced_sites() {
  local n_per_site="$1"
  local output_dir="$2"
  local site_prefix="${3:-site}"
  local num_sites="${4:-3}"
  
  for i in $(seq 1 "$num_sites"); do
    local site_id="${site_prefix}-${i}"
    echo "  Generating $site_id (n=$n_per_site)..."
    generate_site_data "$site_id" "$n_per_site" 0.5 \
      "$output_dir/${site_id}-data.json"
  done
}

# Generate data for multiple sites with different sizes
# Usage: generate_imbalanced_sites <sizes_array> <output_dir> <site_prefix>
generate_imbalanced_sites() {
  local -n sizes_ref="$1"
  local output_dir="$2"
  local site_prefix="${3:-site-imb}"
  
  for i in "${!sizes_ref[@]}"; do
    local site_id="${site_prefix}-$((i+1))"
    local n="${sizes_ref[$i]}"
    echo "  Generating $site_id (n=$n)..."
    generate_site_data "$site_id" "$n" 0.5 \
      "$output_dir/${site_id}-data.json"
  done
}

##############################################################################
# Real Data Loading Functions
##############################################################################

# Load split Synthea data from research/data/raw/splits directory
# Usage: load_split_data <dataset_name> <output_dir> <site_prefix> [num_sites]
# dataset_name: "1k", "100k", "2.8m" (Synthea datasets only)
# Copies split data to output_dir and names them as <site_prefix>-1-data.json, etc.
load_split_data() {
  local dataset_name="$1"
  local output_dir="$2"
  local site_prefix="${3:-site}"
  local num_sites="${4:-3}"
  
  local split_dir="$PROJECT_ROOT/research/data/raw/splits/$dataset_name"
  
  # Verify split directory exists
  if [ ! -d "$split_dir" ]; then
    echo -e "${RED}ERROR: Split data not found at $split_dir${NC}"
    echo "Please run: npm run data:split:$dataset_name"
    return 1
  fi
  
  # Verify metadata exists
  if [ ! -f "$split_dir/metadata.json" ]; then
    echo -e "${RED}ERROR: metadata.json not found in $split_dir${NC}"
    return 1
  fi
  
  # Copy split data files and extract patients array
  for i in $(seq 1 "$num_sites"); do
    local source_file="$split_dir/site${i}.json"
    local dest_file="$output_dir/${site_prefix}-${i}-data.json"
    
    if [ ! -f "$source_file" ]; then
      echo -e "${RED}ERROR: $source_file not found${NC}"
      return 1
    fi
    
    # Extract .patients array from split data structure
    # Split data structure: {metadata: {...}, patients: [...]}
    # CLI expects: [{patientId, treatment, outcome, ...}, ...]
    jq '.patients' "$source_file" > "$dest_file"
  done
  
  # Copy metadata
  cp "$split_dir/metadata.json" "$output_dir/metadata.json"
  
  return 0
}

# Load MIMIC data (single test dataset, no splitting)
# Usage: load_mimic_data <output_dir>
# Prepares MIMIC OMOP data and saves as single test dataset
load_mimic_data() {
  local output_dir="$1"
  local mimic_omop_dir="$PROJECT_ROOT/research/data/raw/omop-data/mimic-demo"
  local mimic_output="$output_dir/mimic-test-data.json"
  local mimic_csv="$output_dir/mimic-test-data.csv"
  
  # Verify MIMIC OMOP directory exists
  if [ ! -d "$mimic_omop_dir" ]; then
    echo -e "${RED}ERROR: MIMIC OMOP data not found at $mimic_omop_dir${NC}"
    echo "Please run: npm run data:download:mimic"
    return 1
  fi
  
  # Verify required CSV files exist
  if [ ! -f "$mimic_omop_dir/person.csv" ] || \
     [ ! -f "$mimic_omop_dir/condition_occurrence.csv" ] || \
     [ ! -f "$mimic_omop_dir/visit_occurrence.csv" ]; then
    echo -e "${RED}ERROR: Required MIMIC CSV files not found${NC}"
    return 1
  fi
  
  echo "  Preparing MIMIC test data..."
  
  # Run MIMIC data preparation script
  cd "$PROJECT_ROOT/research/cli-workflows/utils"
  npx ts-node prepare-mimic-data.ts \
    "$mimic_omop_dir" \
    "$mimic_output" \
    > /dev/null 2>&1
  
  if [ ! -f "$mimic_output" ]; then
    echo -e "${RED}ERROR: MIMIC data preparation failed${NC}"
    return 1
  fi
  
  echo -e "  ${GREEN}✓ MIMIC test data prepared${NC}"
  return 0
}

# Get sample sizes from loaded split data
# Usage: get_split_data_sizes <output_dir> <site_prefix> <num_sites>
# Returns: Prints sample sizes for each site
get_split_data_sizes() {
  local output_dir="$1"
  local site_prefix="${2:-site}"
  local num_sites="${3:-3}"
  
  for i in $(seq 1 "$num_sites"); do
    local data_file="$output_dir/${site_prefix}-${i}-data.json"
    if [ -f "$data_file" ]; then
      local size=$(jq 'length' "$data_file")
      echo "    Site $i: n=$size"
    fi
  done
}

# Get sample size from MIMIC test data
# Usage: get_mimic_data_size <output_dir>
# Returns: Prints MIMIC test data sample size
get_mimic_data_size() {
  local output_dir="$1"
  local mimic_file="$output_dir/mimic-test-data.json"
  
  if [ -f "$mimic_file" ]; then
    local size=$(jq 'length' "$mimic_file")
    echo "    MIMIC test data: n=$size"
  fi
}

##############################################################################
# Bounds Computation Functions
##############################################################################

# Compute bounds for a single site
# Usage: compute_site_bounds <data_file> <output_file> <assumption>
compute_site_bounds() {
  local data_file="$1"
  local output_file="$2"
  local assumption="${3:-mtr}"
  
  node "$CLI_PATH" causal compute-bounds \
    --data "$data_file" \
    --assumption "$assumption" \
    --output "$output_file" \
    > /dev/null 2>&1
}

# Compute bounds for all sites in a directory
# Usage: compute_bounds_for_sites <data_dir> <site_prefix> <num_sites> <assumption>
compute_bounds_for_sites() {
  local data_dir="$1"
  local site_prefix="$2"
  local num_sites="$3"
  local assumption="${4:-mtr}"
  
  for i in $(seq 1 "$num_sites"); do
    local site_id="${site_prefix}-${i}"
    compute_site_bounds \
      "$data_dir/${site_id}-data.json" \
      "$data_dir/${site_id}-bounds.json" \
      "$assumption"
  done
}

##############################################################################
# Federated Bounds Aggregation Functions
##############################################################################

# Federate bounds with a specific strategy
# Usage: federate_bounds_with_strategy <strategy> <output_file> <bounds_files...>
federate_bounds_with_strategy() {
  local strategy="$1"
  local output_file="$2"
  shift 2
  local bounds_files=("$@")
  
  node "$CLI_PATH" causal federate-bounds \
    -s "${bounds_files[@]}" \
    --strategy "$strategy" \
    --output "$output_file" \
    > /dev/null 2>&1
}

# Compare multiple aggregation strategies
# Usage: compare_aggregation_strategies <output_dir> <prefix> <bounds_files...>
compare_aggregation_strategies() {
  local output_dir="$1"
  local prefix="$2"
  shift 2
  local bounds_files=("$@")
  
  local strategies=("weighted-average" "conservative" "uniform" "inverse-width")
  
  for strategy in "${strategies[@]}"; do
    local output_file="$output_dir/${prefix}_${strategy}.json"
    federate_bounds_with_strategy "$strategy" "$output_file" "${bounds_files[@]}"
    
    # Extract and display results
    local lower upper width
    lower=$(jq -r '.lower' "$output_file")
    upper=$(jq -r '.upper' "$output_file")
    width=$(jq -r '.width' "$output_file")
    
    printf "    %-20s → ATE ∈ [%.4f, %.4f] (width=%.4f)\n" \
      "$strategy" "$lower" "$upper" "$width"
  done
}

##############################################################################
# E-value and FRI Functions
##############################################################################

# Compute E-value from bounds
# Usage: compute_evalue_from_bounds <bounds_file> <baseline_risk> <output_file>
compute_evalue_from_bounds() {
  local bounds_file="$1"
  local baseline_risk="${2:-0.4}"
  local output_file="$3"
  
  node "$CLI_PATH" causal compute-evalue \
    --bounds-file "$bounds_file" \
    --baseline-risk "$baseline_risk" \
    --output "$output_file" \
    > /dev/null 2>&1
}

# Compute FRI with a specific strategy
# Usage: compute_fri <sites_file> <strategy> <output_file>
compute_fri() {
  local sites_file="$1"
  local strategy="$2"
  local output_file="$3"
  
  node "$CLI_PATH" causal compute-fri \
    --sites-file "$sites_file" \
    --strategy "$strategy" \
    --output "$output_file" \
    --format json \
    > /dev/null 2>&1
}

# Compare FRI strategies
# Usage: compare_fri_strategies <sites_file> <output_dir> <prefix>
compare_fri_strategies() {
  local sites_file="$1"
  local output_dir="$2"
  local prefix="$3"
  
  local strategies=("sample-size" "sqrt" "log" "equal")
  
  echo -e "${BLUE}Comparing FRI strategies:${NC}"
  for strategy in "${strategies[@]}"; do
    local output_file="$output_dir/${prefix}_fri_${strategy}.json"
    compute_fri "$sites_file" "$strategy" "$output_file"
    
    local fri min_e med_e avg_e
    min_e=$(jq -r '.fri.min_evalue' "$output_file")
    med_e=$(jq -r '.fri.median_evalue' "$output_file")
    avg_e=$(jq -r '.fri.weighted_avg_evalue' "$output_file")
    printf "    %-15s → Min=%.2f  Med=%.2f  Avg=%.2f\n" "$strategy" "$min_e" "$med_e" "$avg_e"
  done
}

##############################################################################
# Assumption Diagnostics Functions
##############################################################################

# Diagnose assumptions for a single site
# Usage: diagnose_site_assumptions <data_file> <output_file>
diagnose_site_assumptions() {
  local data_file="$1"
  local output_file="$2"
  
  node "$CLI_PATH" causal diagnose-assumptions \
    --data-file "$data_file" \
    --output "$output_file" \
    > /dev/null 2>&1
}

# Diagnose assumptions in parallel across multiple sites
# Usage: diagnose_sites_parallel <data_dir> <output_file>
diagnose_sites_parallel() {
  local data_dir="$1"
  local output_file="$2"
  
  echo "  Running parallel assumption diagnostics..."
  node "$CLI_PATH" causal diagnose-assumptions-parallel \
    --data-dir "$data_dir" \
    --site-pattern "site-*-data.json" \
    --format json \
    --output "$output_file"
  
  if [ $? -eq 0 ]; then
    echo "  ✓ Parallel diagnostics complete"
    return 0
  else
    echo "  ✗ Parallel diagnostics failed"
    return 1
  fi
}

# Display assumption scores
# Usage: display_assumption_scores <assumptions_file> <site_id>
display_assumption_scores() {
  local assumptions_file="$1"
  local site_id="$2"
  
  echo "    $site_id scores:"
  jq -r '.scores | 
    "      Overall: \(.overall_score | tostring | .[0:5])  " + 
    "Unconfoundedness: \(.unconfoundedness_score | tostring | .[0:5])  " +
    "Positivity: \(.positivity_score | tostring | .[0:5])  " +
    "Specification: \(.specification_score | tostring | .[0:5])"' \
    "$assumptions_file"
}

# Display parallel assumption scores (from array output)
# Usage: display_parallel_scores <results_file>
display_parallel_scores() {
  local results_file="$1"
  
  echo "  Assumption scores summary:"
  jq -r '.[] | 
    "    Site \(.siteId):  " +
    "Overall=\(.scores.overall_score | tostring | .[0:5])  " +
    "Unconf=\(.scores.unconfoundedness_score | tostring | .[0:5])  " +
    "Posit=\(.scores.positivity_score | tostring | .[0:5])  " +
    "Spec=\(.scores.specification_score | tostring | .[0:5])"' \
    "$results_file"
}

##############################################################################
# Inference Mode Selection Functions
##############################################################################

# Select inference mode for a site
# Usage: select_site_mode <assumptions_file> <output_file>
select_site_mode() {
  local assumptions_file="$1"
  local output_file="$2"
  
  node "$CLI_PATH" causal select-inference-mode \
    --data-file "$assumptions_file" \
    --output "$output_file" \
    > /dev/null 2>&1
}

# Display selected mode
# Usage: display_selected_mode <mode_file> <site_id>
display_selected_mode() {
  local mode_file="$1"
  local site_id="$2"
  
  echo "    $site_id mode:"
  jq -r '"      \(.mode | ascii_upcase) (confidence: \((.confidence * 100) | tostring | .[0:4])%)"' \
    "$mode_file"
}

##############################################################################
# Reporting Functions
##############################################################################

# Print section header
# Usage: print_section_header <title>
print_section_header() {
  local title="$1"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  $title"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

# Print experiment header
# Usage: print_experiment_header <experiment_name>
print_experiment_header() {
  local experiment_name="$1"
  echo ""
  echo -e "${BLUE}$experiment_name${NC}"
  echo ""
}

# Print success message
# Usage: print_success <message>
print_success() {
  local message="$1"
  echo -e "${GREEN}✓ $message${NC}"
}

# Print info message
# Usage: print_info <message>
print_info() {
  local message="$1"
  echo -e "${CYAN}ℹ $message${NC}"
}

# Print warning message
# Usage: print_warning <message>
print_warning() {
  local message="$1"
  echo -e "${YELLOW}⚠ $message${NC}"
}

# Print error message
# Usage: print_error <message>
print_error() {
  local message="$1"
  echo -e "${RED}✗ $message${NC}"
}

# Generate markdown summary table for strategies
# Usage: generate_strategy_comparison_table <output_dir> <prefix> <output_md>
generate_strategy_comparison_table() {
  local output_dir="$1"
  local prefix="$2"
  local output_md="$3"
  
  cat > "$output_md" << 'EOF'
# Strategy Comparison Results

## Summary

| Strategy | Lower Bound | Upper Bound | Width | Sample Size |
|----------|-------------|-------------|-------|-------------|
EOF

  local strategies=("weighted-average" "conservative" "uniform" "inverse-width")
  
  for strategy in "${strategies[@]}"; do
    local file="$output_dir/${prefix}_${strategy}.json"
    if [[ -f "$file" ]]; then
      local lower upper width sample_size
      lower=$(jq -r '.lower' "$file")
      upper=$(jq -r '.upper' "$file")
      width=$(jq -r '.width' "$file")
      sample_size=$(jq -r '.sampleSize' "$file")
      
      echo "| $strategy | $lower | $upper | $width | $sample_size |" >> "$output_md"
    fi
  done
  
  echo "" >> "$output_md"
}

##############################################################################
# Utility Functions
##############################################################################

# Check if jq is installed
check_dependencies() {
  if ! command -v jq &> /dev/null; then
    print_error "jq is not installed. Please install jq to process JSON files."
    exit 1
  fi
}

# Create multi-site JSON file from individual site files
# Usage: create_multisite_json <output_file> <site_files...>
create_multisite_json() {
  local output_file="$1"
  shift
  local site_files=("$@")
  
  echo "{" > "$output_file"
  echo '  "sites": [' >> "$output_file"
  
  local first=true
  for site_file in "${site_files[@]}"; do
    if [[ ! -f "$site_file" ]]; then
      continue
    fi
    
    if [[ "$first" == false ]]; then
      echo "    ," >> "$output_file"
    fi
    first=false
    
    local site_id
    site_id=$(basename "$site_file" | sed 's/-.*$//')
    
    echo "    {" >> "$output_file"
    echo "      \"site_id\": \"$site_id\"," >> "$output_file"
    echo -n "      \"data\": " >> "$output_file"
    cat "$site_file" >> "$output_file"
    echo "" >> "$output_file"
    echo -n "    }" >> "$output_file"
  done
  
  echo "" >> "$output_file"
  echo "  ]" >> "$output_file"
  echo "}" >> "$output_file"
}

# Export functions for use in other scripts
export -f generate_site_data
export -f generate_balanced_sites
export -f generate_imbalanced_sites
export -f load_split_data
export -f get_split_data_sizes
export -f load_mimic_data
export -f get_mimic_data_size
export -f compute_site_bounds
export -f compute_bounds_for_sites
export -f federate_bounds_with_strategy
export -f compare_aggregation_strategies
export -f compute_evalue_from_bounds
export -f compute_fri
export -f compare_fri_strategies
export -f diagnose_site_assumptions
export -f display_assumption_scores
export -f select_site_mode
export -f display_selected_mode
export -f print_section_header
export -f print_experiment_header
export -f print_success
export -f print_info
export -f print_warning
export -f print_error
export -f generate_strategy_comparison_table
export -f check_dependencies
export -f create_multisite_json

# Check dependencies on import
check_dependencies

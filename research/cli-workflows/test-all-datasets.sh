#!/bin/bash
##############################################################################
# Test All Modules with All Datasets
#
# Runs all 5 research modules with 4 different datasets:
# - 1k: 1,000 patients (small-scale testing)
# - 100k: 100,000 patients (medium-scale validation)
# - 2.8m: 2,800,000 patients (large-scale real-world)
# - mimic-demo: MIMIC-IV demo data (real clinical data)
#
# This ensures all research findings are validated across multiple data scales.
##############################################################################

set -e  # Exit on error

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Import shared functions
source "$SCRIPT_DIR/utils/shared-functions.sh"

# Parse command line arguments
DATASETS=("1k" "100k" "2.8m" "mimic-demo")
MODULES=(1 2 3 4 5)
SELECTED_DATASETS=()
SELECTED_MODULES=()

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --datasets)
      IFS=',' read -ra SELECTED_DATASETS <<< "$2"
      shift 2
      ;;
    --modules)
      IFS=',' read -ra SELECTED_MODULES <<< "$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --datasets <list>    Comma-separated list of datasets (1k,100k,2.8m,mimic-demo)"
      echo "  --modules <list>     Comma-separated list of module numbers (1,2,3,4,5)"
      echo "  --help               Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                                    # Run all modules with all datasets"
      echo "  $0 --datasets 1k,100k                # Run all modules with 1k and 100k"
      echo "  $0 --modules 2,3                      # Run modules 2 and 3 with all datasets"
      echo "  $0 --datasets 2.8m --modules 2       # Run module 2 with 2.8m dataset only"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Use all datasets/modules if none specified
if [ ${#SELECTED_DATASETS[@]} -eq 0 ]; then
  SELECTED_DATASETS=("${DATASETS[@]}")
fi

if [ ${#SELECTED_MODULES[@]} -eq 0 ]; then
  SELECTED_MODULES=("${MODULES[@]}")
fi

echo "════════════════════════════════════════════════════════════════════"
echo "  🧪 Testing All Modules with All Datasets"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "  Datasets: ${SELECTED_DATASETS[*]}"
echo "  Modules:  ${SELECTED_MODULES[*]}"
echo ""

##############################################################################
# Helper: Load dataset (handles both Synthea splits and MIMIC)
##############################################################################
load_dataset() {
  local dataset="$1"
  local data_dir="$2"
  
  if [ "$dataset" = "mimic-demo" ]; then
    if ! load_mimic_data "$data_dir"; then
      return 1
    fi
    get_mimic_data_size "$data_dir"
  else
    if ! load_split_data "$dataset" "$data_dir" "site" 3; then
      return 1
    fi
    get_split_data_sizes "$data_dir" "site" 3
  fi
  
  return 0
}

# Helper: Check if dataset is MIMIC (single test dataset)
is_mimic_dataset() {
  [ "$1" = "mimic-demo" ]
}

##############################################################################
# Verify all required data exists
##############################################################################
print_section_header "Verifying Data Availability"

missing_datasets=()
for dataset in "${SELECTED_DATASETS[@]}"; do
  if [ "$dataset" = "mimic-demo" ]; then
    # Check MIMIC OMOP data
    mimic_dir="$PROJECT_ROOT/research/data/raw/omop-data/mimic-demo"
    if [ ! -d "$mimic_dir" ] || [ ! -f "$mimic_dir/person.csv" ]; then
      missing_datasets+=("$dataset")
      echo -e "  ${YELLOW}⚠ MIMIC data not found at $mimic_dir${NC}"
    else
      echo -e "  ${GREEN}✓ MIMIC test data found${NC}"
    fi
  else
    # Check Synthea split data
    split_dir="$PROJECT_ROOT/research/data/raw/splits/$dataset"
    if [ ! -d "$split_dir" ] || [ ! -f "$split_dir/site1.json" ]; then
      missing_datasets+=("$dataset")
      echo -e "  ${YELLOW}⚠ Synthea dataset '$dataset' not found at $split_dir${NC}"
    else
      echo -e "  ${GREEN}✓ Synthea dataset '$dataset' found${NC}"
    fi
  fi
done

if [ ${#missing_datasets[@]} -gt 0 ]; then
  echo ""
  echo -e "${RED}ERROR: Missing datasets: ${missing_datasets[*]}${NC}"
  echo ""
  echo "Please download and/or split the missing datasets:"
  for dataset in "${missing_datasets[@]}"; do
    if [ "$dataset" = "mimic-demo" ]; then
      echo "  npm run data:download:mimic"
    else
      echo "  npm run data:download:$dataset"
      echo "  npm run data:split:$dataset"
    fi
  done
  exit 1
fi

print_success "All required datasets available"
echo ""

##############################################################################
# Module 1: Manski Bounds
##############################################################################
run_module_1() {
  local dataset="$1"
  local output_dir="$SCRIPT_DIR/output/manski-bounds-$dataset"
  local data_dir="$output_dir/data"
  
  mkdir -p "$output_dir" "$data_dir"
  
  print_experiment_header "Module 1: Manski Bounds - $dataset"
  
  # Handle MIMIC separately (single test dataset, no federation)
  if [ "$dataset" = "mimic-demo" ]; then
    echo "  Loading MIMIC test data (single dataset, no federation)..."
    if ! load_mimic_data "$data_dir"; then
      print_error "Failed to load MIMIC data"
      return 1
    fi
    
    echo "  Sample size:"
    get_mimic_data_size "$data_dir"
    echo ""
    
    # Compute bounds for single MIMIC dataset
    echo "  Computing worst-case bounds..."
    compute_site_bounds \
      "$data_dir/mimic-test-data.json" \
      "$data_dir/mimic-worst-case.json" \
      "worst-case"
    
    echo "  Computing MTR bounds..."
    compute_site_bounds \
      "$data_dir/mimic-test-data.json" \
      "$data_dir/mimic-mtr.json" \
      "mtr"
    
    # Copy results to output (no federation for single dataset)
    cp "$data_dir/mimic-mtr.json" "$output_dir/mimic-demo_single-site.json"
    
    print_success "Module 1 (MIMIC test data) complete"
    echo ""
    return 0
  fi
  
  # Load split Synthea data (federated learning)
  if ! load_split_data "$dataset" "$data_dir" "site" 3; then
    print_error "Failed to load $dataset data"
    return 1
  fi
  
  echo "  Sample sizes:"
  get_split_data_sizes "$data_dir" "site" 3
  echo ""
  
  # Compute worst-case bounds
  echo "  Computing worst-case bounds..."
  for i in {1..3}; do
    compute_site_bounds \
      "$data_dir/site-${i}-data.json" \
      "$data_dir/site-${i}-worst-case.json" \
      "worst-case"
  done
  
  # Compute MTR bounds
  echo "  Computing MTR bounds..."
  for i in {1..3}; do
    compute_site_bounds \
      "$data_dir/site-${i}-data.json" \
      "$data_dir/site-${i}-mtr.json" \
      "mtr"
  done
  
  # Federate bounds
  echo "  Federating bounds..."
  compare_aggregation_strategies "$output_dir" "${dataset}" \
    "$data_dir/site-1-mtr.json" \
    "$data_dir/site-2-mtr.json" \
    "$data_dir/site-3-mtr.json"
  
  print_success "Module 1 ($dataset) complete"
  echo ""
}

##############################################################################
# Module 2: Federated Partial Identification
##############################################################################
run_module_2() {
  local dataset="$1"
  local output_dir="$SCRIPT_DIR/output/federated-partial-id-$dataset"
  local data_dir="$output_dir/data"
  
  mkdir -p "$output_dir" "$data_dir"
  
  print_experiment_header "Module 2: Federated Partial Identification - $dataset"
  
  # MIMIC: single test dataset (no federation)
  if is_mimic_dataset "$dataset"; then
    echo "  Loading MIMIC test data..."
    if ! load_dataset "$dataset" "$data_dir"; then
      print_error "Failed to load MIMIC data"
      return 1
    fi
    echo ""
    
    echo "  Computing MTR bounds for MIMIC test..."
    compute_site_bounds \
      "$data_dir/mimic-test-data.json" \
      "$data_dir/mimic-bounds.json" \
      "mtr"
    
    cp "$data_dir/mimic-bounds.json" "$output_dir/mimic-demo_single-site.json"
    
    print_success "Module 2 (MIMIC test) complete"
    echo ""
    return 0
  fi
  
  # Synthea: federated learning with 3 sites
  echo "  Loading Synthea split data..."
  if ! load_dataset "$dataset" "$data_dir"; then
    print_error "Failed to load $dataset data"
    return 1
  fi
  echo ""
  
  # Compute MTR bounds
  echo "  Computing MTR bounds..."
  for i in {1..3}; do
    compute_site_bounds \
      "$data_dir/site-${i}-data.json" \
      "$data_dir/site-${i}-bounds.json" \
      "mtr"
  done
  
  # Compare aggregation strategies
  echo "  Comparing aggregation strategies..."
  compare_aggregation_strategies "$output_dir" "${dataset}" \
    "$data_dir/site-1-bounds.json" \
    "$data_dir/site-2-bounds.json" \
    "$data_dir/site-3-bounds.json"
  
  print_success "Module 2 ($dataset) complete"
  echo ""
}

##############################################################################
# Module 3: Federated E-values
##############################################################################
run_module_3() {
  local dataset="$1"
  local output_dir="$SCRIPT_DIR/output/federated-evalues-$dataset"
  local data_dir="$output_dir/data"
  
  mkdir -p "$output_dir" "$data_dir"
  
  print_experiment_header "Module 3: Federated E-values - $dataset"
  
  # MIMIC: single test dataset
  if is_mimic_dataset "$dataset"; then
    echo "  Loading MIMIC test data..."
    if ! load_dataset "$dataset" "$data_dir"; then
      print_error "Failed to load MIMIC data"
      return 1
    fi
    echo ""
    
    echo "  Computing bounds and E-value for MIMIC test..."
    compute_site_bounds \
      "$data_dir/mimic-test-data.json" \
      "$data_dir/mimic-bounds.json" \
      "mtr"
    
    compute_evalue_from_bounds \
      "$data_dir/mimic-bounds.json" \
      "$data_dir/mimic-evalue.json"
    
    cp "$data_dir/mimic-evalue.json" "$output_dir/mimic-demo_evalues.json"
    
    print_success "Module 3 (MIMIC test) complete"
    echo ""
    return 0
  fi
  
  # Synthea: federated learning
  echo "  Loading Synthea split data..."
  if ! load_dataset "$dataset" "$data_dir"; then
    print_error "Failed to load $dataset data"
    return 1
  fi
  echo ""
  
  # Compute bounds
  echo "  Computing MTR bounds..."
  for i in {1..3}; do
    compute_site_bounds \
      "$data_dir/site-${i}-data.json" \
      "$data_dir/site-${i}-bounds.json" \
      "mtr"
  done
  
  # Compute E-values
  echo "  Computing E-values..."
  for i in {1..3}; do
    compute_evalue_from_bounds \
      "$data_dir/site-${i}-bounds.json" \
      "$data_dir/site-${i}-evalue.json"
  done
  
  # Compute FRI
  echo "  Computing Federated Robustness Index..."
  compute_fri \
    "$data_dir" \
    "$output_dir/fri-results.json" \
    "site" \
    3
  
  print_success "Module 3 ($dataset) complete"
  echo ""
}

##############################################################################
# Module 4: Design-Failure-Aware Causal
##############################################################################
run_module_4() {
  local dataset="$1"
  local output_dir="$SCRIPT_DIR/output/design-failure-aware-$dataset"
  local data_dir="$output_dir/data"
  
  mkdir -p "$output_dir" "$data_dir"
  
  print_experiment_header "Module 4: Design-Failure-Aware Causal - $dataset"
  
  # MIMIC: single test dataset
  if is_mimic_dataset "$dataset"; then
    echo "  Loading MIMIC test data..."
    if ! load_dataset "$dataset" "$data_dir"; then
      print_error "Failed to load MIMIC data"
      return 1
    fi
    echo ""
    
    echo "  Diagnosing assumptions for MIMIC test..."
    diagnose_site_assumptions \
      "$data_dir/mimic-test-data.json" \
      "$data_dir/mimic-diagnosis.json"
    
    echo "  Computing bounds..."
    compute_site_bounds \
      "$data_dir/mimic-test-data.json" \
      "$data_dir/mimic-bounds.json" \
      "mtr"
    
    cp "$data_dir/mimic-diagnosis.json" "$output_dir/mimic-demo_diagnosis.json"
    
    print_success "Module 4 (MIMIC test) complete"
    echo ""
    return 0
  fi
  
  # Synthea: federated learning
  echo "  Loading Synthea split data..."
  if ! load_dataset "$dataset" "$data_dir"; then
    print_error "Failed to load $dataset data"
    return 1
  fi
  echo ""
  
  # Diagnose assumptions in parallel across all sites
  echo "  Diagnosing assumptions (parallel)..."
  diagnose_sites_parallel \
    "$data_dir" \
    "$data_dir/parallel-diagnosis.json"
  
  # Extract individual site results for compatibility
  for i in {1..3}; do
    jq --arg site "site_${i}" '.[] | select(.siteId == $site)' \
      "$data_dir/parallel-diagnosis.json" > "$data_dir/site-${i}-diagnosis.json"
  done
  
  display_parallel_scores "$data_dir/parallel-diagnosis.json"
  
  # Compute bounds based on diagnosis
  echo "  Computing adaptive bounds..."
  for i in {1..3}; do
    # For now, use MTR bounds as default
    compute_site_bounds \
      "$data_dir/site-${i}-data.json" \
      "$data_dir/site-${i}-bounds.json" \
      "mtr"
  done
  
  print_success "Module 4 ($dataset) complete"
  echo ""
}

##############################################################################
# Module 5: Identification-Sensitivity-Adaptation
##############################################################################
run_module_5() {
  local dataset="$1"
  local output_dir="$SCRIPT_DIR/output/identification-sensitivity-adaptation-$dataset"
  local data_dir="$output_dir/data"
  
  mkdir -p "$output_dir" "$data_dir"
  
  print_experiment_header "Module 5: Identification-Sensitivity-Adaptation - $dataset"
  
  # MIMIC: single test dataset
  if is_mimic_dataset "$dataset"; then
    echo "  Loading MIMIC test data..."
    if ! load_dataset "$dataset" "$data_dir"; then
      print_error "Failed to load MIMIC data"
      return 1
    fi
    echo ""
    
    echo "  Computing bounds, E-value for MIMIC test..."
    compute_site_bounds \
      "$data_dir/mimic-test-data.json" \
      "$data_dir/mimic-bounds.json" \
      "mtr"
    
    compute_evalue_from_bounds \
      "$data_dir/mimic-bounds.json" \
      "$data_dir/mimic-evalue.json"
    
    cp "$data_dir/mimic-evalue.json" "$output_dir/mimic-demo_results.json"
    
    print_success "Module 5 (MIMIC test) complete"
    echo ""
    return 0
  fi
  
  # Synthea: federated learning
  echo "  Loading Synthea split data..."
  if ! load_dataset "$dataset" "$data_dir"; then
    print_error "Failed to load $dataset data"
    return 1
  fi
  echo ""
  
  # Compute bounds
  echo "  Computing MTR bounds..."
  for i in {1..3}; do
    compute_site_bounds \
      "$data_dir/site-${i}-data.json" \
      "$data_dir/site-${i}-bounds.json" \
      "mtr"
  done
  
  # Compute E-values
  echo "  Computing E-values..."
  for i in {1..3}; do
    compute_evalue_from_bounds \
      "$data_dir/site-${i}-bounds.json" \
      "$data_dir/site-${i}-evalue.json"
  done
  
  # Compute FRI
  echo "  Computing FRI..."
  compute_fri \
    "$data_dir" \
    "$output_dir/fri-results.json" \
    "site" \
    3
  
  print_success "Module 5 ($dataset) complete"
  echo ""
}

##############################################################################
# Main execution loop
##############################################################################

total_tests=$((${#SELECTED_DATASETS[@]} * ${#SELECTED_MODULES[@]}))
current_test=0
failed_tests=()

for dataset in "${SELECTED_DATASETS[@]}"; do
  for module in "${SELECTED_MODULES[@]}"; do
    current_test=$((current_test + 1))
    
    echo ""
    echo "════════════════════════════════════════════════════════════════════"
    echo "  Test ${current_test}/${total_tests}: Module ${module} with ${dataset} dataset"
    echo "════════════════════════════════════════════════════════════════════"
    echo ""
    
    case $module in
      1)
        if ! run_module_1 "$dataset"; then
          failed_tests+=("Module $module with $dataset")
        fi
        ;;
      2)
        if ! run_module_2 "$dataset"; then
          failed_tests+=("Module $module with $dataset")
        fi
        ;;
      3)
        if ! run_module_3 "$dataset"; then
          failed_tests+=("Module $module with $dataset")
        fi
        ;;
      4)
        if ! run_module_4 "$dataset"; then
          failed_tests+=("Module $module with $dataset")
        fi
        ;;
      5)
        if ! run_module_5 "$dataset"; then
          failed_tests+=("Module $module with $dataset")
        fi
        ;;
      *)
        echo -e "${RED}ERROR: Unknown module $module${NC}"
        failed_tests+=("Module $module with $dataset")
        ;;
    esac
  done
done

##############################################################################
# Summary
##############################################################################
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  📊 Test Summary"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "  Total tests: $total_tests"
echo "  Successful:  $((total_tests - ${#failed_tests[@]}))"
echo "  Failed:      ${#failed_tests[@]}"
echo ""

if [ ${#failed_tests[@]} -gt 0 ]; then
  echo -e "${RED}Failed tests:${NC}"
  for test in "${failed_tests[@]}"; do
    echo "  • $test"
  done
  echo ""
  exit 1
else
  echo -e "${GREEN}✓ All tests passed successfully!${NC}"
  echo ""
  echo "Results saved to:"
  for dataset in "${SELECTED_DATASETS[@]}"; do
    for module in "${SELECTED_MODULES[@]}"; do
      case $module in
        1) echo "  • research/cli-workflows/output/manski-bounds-$dataset/" ;;
        2) echo "  • research/cli-workflows/output/federated-partial-id-$dataset/" ;;
        3) echo "  • research/cli-workflows/output/federated-evalues-$dataset/" ;;
        4) echo "  • research/cli-workflows/output/design-failure-aware-$dataset/" ;;
        5) echo "  • research/cli-workflows/output/identification-sensitivity-adaptation-$dataset/" ;;
      esac
    done
  done
  echo ""
fi

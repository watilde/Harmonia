#!/bin/bash

##############################################################################
# Polypharmacy Federated Causal Inference - Test Runner
#
# This script runs various scale tests for the manuscript validation.
# All tests use OMOP CDM v5.4 format and federated aggregation.
##############################################################################

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "🏥 Polypharmacy Federated Causal Inference Test Runner"
echo "======================================================"
echo ""

# Function to display usage
usage() {
    cat << EOF
Usage: $0 [test_type]

Test Types:
  quick       - Quick validation (10K patients, ~5 seconds)
  unit        - OMOP integration unit tests (~5 seconds)
  1m          - 1 million patients test (~5 seconds)
  10m         - 10 million patients test (~50 seconds)
  100m        - 100 million patients test (~8 minutes)
  1b          - 1 billion patients test (~10 minutes, manuscript)
  tiers       - Compare all 3 interaction tiers (~15 seconds)
  profiles    - Compare all site profiles (~20 seconds)
  all         - Run all tests (~20 minutes)

Examples:
  $0 quick        # Run quick validation
  $0 1m           # Run 1M patient test
  $0 1b           # Run full manuscript replication
  $0 tiers        # Compare all interaction tiers

Output:
  Results are saved to: $SCRIPT_DIR/test-results/
EOF
    exit 1
}

# Create results directory
RESULTS_DIR="$SCRIPT_DIR/test-results"
mkdir -p "$RESULTS_DIR"

# Check if CLI is built
if [ ! -f "$PROJECT_ROOT/packages/cli/dist/cli.js" ]; then
    echo "❌ CLI not built. Building now..."
    cd "$PROJECT_ROOT"
    npm run build
fi

CLI_CMD="node $PROJECT_ROOT/packages/cli/dist/cli.js causal run-polypharmacy"

##############################################################################
# Test Functions
##############################################################################

run_unit_tests() {
    echo "🧪 Running OMOP Integration Unit Tests"
    echo "----------------------------------------"
    cd "$SCRIPT_DIR"
    npx tsx src/test-omop-integration.ts
    echo ""
}

run_quick_test() {
    echo "⚡ Running Quick Validation Test (10K patients)"
    echo "------------------------------------------------"
    $CLI_CMD \
        --sites 10 \
        --patients 1000 \
        --tier 3 \
        --output "$RESULTS_DIR/quick-10k"
    echo ""
    echo "📊 Results: $RESULTS_DIR/quick-10k/results.json"
    cat "$RESULTS_DIR/quick-10k/results.json" | jq '.federatedEstimate'
    echo ""
}

run_1m_test() {
    echo "📈 Running 1 Million Patient Test"
    echo "----------------------------------"
    $CLI_CMD \
        --sites 10 \
        --patients 100000 \
        --tier 3 \
        --output "$RESULTS_DIR/test-1m" \
        --verbose
    echo ""
    echo "📊 Results: $RESULTS_DIR/test-1m/results.json"
    cat "$RESULTS_DIR/test-1m/results.json" | jq '{
        totalPatients: .config.totalPatients,
        tierPrevalence: .config.tierPrevalence,
        trueEffect: .config.trueEffect,
        estimatedATE: .federatedEstimate.ate,
        confidenceInterval: [.federatedEstimate.ci_lower, .federatedEstimate.ci_upper],
        pvalue: .federatedEstimate.pvalue,
        throughput: .performance.throughputPatientsPerSec,
        communicationKB: .privacy.totalKB,
        reductionFactor: .privacy.reductionFactor
    }'
    echo ""
}

run_10m_test() {
    echo "📈 Running 10 Million Patient Test"
    echo "-----------------------------------"
    $CLI_CMD \
        --sites 100 \
        --patients 100000 \
        --tier 3 \
        --output "$RESULTS_DIR/test-10m" \
        --verbose
    echo ""
    echo "📊 Results: $RESULTS_DIR/test-10m/results.json"
    cat "$RESULTS_DIR/test-10m/results.json" | jq '{
        totalPatients: .config.totalPatients,
        estimatedATE: .federatedEstimate.ate,
        confidenceInterval: [.federatedEstimate.ci_lower, .federatedEstimate.ci_upper],
        pvalue: .federatedEstimate.pvalue,
        throughput: .performance.throughputPatientsPerSec
    }'
    echo ""
}

run_100m_test() {
    echo "📈 Running 100 Million Patient Test (Original Implementation)"
    echo "--------------------------------------------------------------"
    cd "$SCRIPT_DIR"
    node src/run100MOptimized.js
    echo ""
}

run_1b_test() {
    echo "🚀 Running 1 Billion Patient Test (Manuscript Replication)"
    echo "-----------------------------------------------------------"
    echo "⚠️  This will take approximately 10 minutes..."
    echo ""
    
    # Use original implementation for 1B scale
    cd "$SCRIPT_DIR"
    node src/run1BOptimized.js
    
    echo ""
    echo "✅ 1 Billion patient test complete!"
    echo "📊 Expected results (from manuscript):"
    echo "   - Throughput: ~1.56M patients/sec"
    echo "   - Total time: ~10.7 minutes"
    echo "   - Communication: 264 KB total"
    echo "   - Reduction: 705,303x vs centralized"
    echo ""
}

run_tier_comparison() {
    echo "🔬 Comparing All Interaction Tiers (1M patients each)"
    echo "------------------------------------------------------"
    
    # Tier 1: Common (16%)
    echo "Running Tier 1 (Common, 16% prevalence)..."
    $CLI_CMD \
        --sites 10 \
        --patients 100000 \
        --tier 1 \
        --output "$RESULTS_DIR/tier1-1m" > /dev/null
    
    # Tier 2: Moderate (0.4%)
    echo "Running Tier 2 (Moderate, 0.4% prevalence)..."
    $CLI_CMD \
        --sites 10 \
        --patients 100000 \
        --tier 2 \
        --output "$RESULTS_DIR/tier2-1m" > /dev/null
    
    # Tier 3: Ultra-rare (0.064%)
    echo "Running Tier 3 (Ultra-rare, 0.064% prevalence)..."
    $CLI_CMD \
        --sites 10 \
        --patients 100000 \
        --tier 3 \
        --output "$RESULTS_DIR/tier3-1m" > /dev/null
    
    echo ""
    echo "📊 Tier Comparison Results:"
    echo ""
    
    echo "Tier 1 (Common, 16%):"
    cat "$RESULTS_DIR/tier1-1m/results.json" | jq '{
        prevalence: .config.tierPrevalence,
        trueEffect: .config.trueEffect,
        estimatedATE: .federatedEstimate.ate,
        CI: [.federatedEstimate.ci_lower, .federatedEstimate.ci_upper],
        pvalue: .federatedEstimate.pvalue
    }'
    
    echo ""
    echo "Tier 2 (Moderate, 0.4%):"
    cat "$RESULTS_DIR/tier2-1m/results.json" | jq '{
        prevalence: .config.tierPrevalence,
        trueEffect: .config.trueEffect,
        estimatedATE: .federatedEstimate.ate,
        CI: [.federatedEstimate.ci_lower, .federatedEstimate.ci_upper],
        pvalue: .federatedEstimate.pvalue
    }'
    
    echo ""
    echo "Tier 3 (Ultra-rare, 0.064%):"
    cat "$RESULTS_DIR/tier3-1m/results.json" | jq '{
        prevalence: .config.tierPrevalence,
        trueEffect: .config.trueEffect,
        estimatedATE: .federatedEstimate.ate,
        CI: [.federatedEstimate.ci_lower, .federatedEstimate.ci_upper],
        pvalue: .federatedEstimate.pvalue
    }'
    echo ""
}

run_profile_comparison() {
    echo "🌏 Comparing Site Profiles (1M patients each)"
    echo "----------------------------------------------"
    
    for profile in US Japan Nordic India; do
        echo "Running $profile profile..."
        $CLI_CMD \
            --sites 10 \
            --patients 100000 \
            --tier 3 \
            --profile "$profile" \
            --output "$RESULTS_DIR/profile-$profile" > /dev/null
    done
    
    echo ""
    echo "📊 Profile Comparison Results (Tier 3, 1M patients):"
    echo ""
    
    for profile in US Japan Nordic India; do
        echo "$profile Profile:"
        cat "$RESULTS_DIR/profile-$profile/results.json" | jq '{
            profile: .config.siteProfile,
            estimatedATE: .federatedEstimate.ate,
            CI: [.federatedEstimate.ci_lower, .federatedEstimate.ci_upper],
            pvalue: .federatedEstimate.pvalue
        }'
        echo ""
    done
}

run_all_tests() {
    echo "🚀 Running All Tests"
    echo "===================="
    echo ""
    
    run_unit_tests
    run_quick_test
    run_1m_test
    run_tier_comparison
    run_profile_comparison
    
    echo ""
    echo "⚠️  Skipping 10M, 100M, and 1B tests in 'all' mode."
    echo "    Run them individually if needed:"
    echo "    - $0 10m"
    echo "    - $0 100m"
    echo "    - $0 1b"
    echo ""
}

##############################################################################
# Main
##############################################################################

if [ $# -eq 0 ]; then
    usage
fi

TEST_TYPE="$1"

case "$TEST_TYPE" in
    unit)
        run_unit_tests
        ;;
    quick)
        run_quick_test
        ;;
    1m)
        run_1m_test
        ;;
    10m)
        run_10m_test
        ;;
    100m)
        run_100m_test
        ;;
    1b)
        run_1b_test
        ;;
    tiers)
        run_tier_comparison
        ;;
    profiles)
        run_profile_comparison
        ;;
    all)
        run_all_tests
        ;;
    *)
        echo "❌ Unknown test type: $TEST_TYPE"
        echo ""
        usage
        ;;
esac

echo "✅ Test complete!"
echo ""
echo "📁 All results saved to: $RESULTS_DIR"
echo ""

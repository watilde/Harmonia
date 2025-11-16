#!/bin/bash
#
# Download MIMIC-IV Demo OMOP CDM Data
# 
# This script downloads the MIMIC-IV demo dataset in OMOP Common Data Model format
# from PhysioNet.
#
# Dataset: MIMIC-IV demo data in the OMOP Common Data Model v0.9
# DOI: https://doi.org/10.13026/p1f5-7x35
# Size: ~100 patients (demo subset)
# Format: OMOP CDM v5.3
#
# Requirements:
# - wget or curl
# - PhysioNet account (free, requires registration and credentialing)
# - Accepted data use agreement for MIMIC-IV demo
#
# Usage:
#   bash download-mimic-omop-demo.sh
#
# Output:
#   research/data-generation/omop-data/mimic-demo/
#

set -e  # Exit on error

# Determine project root (assumes script is in research/scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATA_DIR="$PROJECT_ROOT/research/data-generation/omop-data/mimic-demo"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MIMIC-IV Demo OMOP CDM Data Download"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}Dataset:${NC}  MIMIC-IV demo in OMOP CDM v5.3"
echo -e "${BLUE}Source:${NC}   PhysioNet (https://doi.org/10.13026/p1f5-7x35)"
echo -e "${BLUE}Size:${NC}     ~100 ICU patients (demo subset)"
echo -e "${BLUE}Output:${NC}   $DATA_DIR"
echo ""

# Create output directory
mkdir -p "$DATA_DIR"

# Check if data already exists
if [ -f "$DATA_DIR/person.csv" ]; then
    echo -e "${YELLOW}⚠️  Data already exists in $DATA_DIR${NC}"
    read -p "   Do you want to re-download? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}✓ Using existing data${NC}"
        exit 0
    fi
    echo "   Removing existing data..."
    rm -rf "$DATA_DIR"/*
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PhysioNet Access Requirements"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This dataset requires PhysioNet credentialing:"
echo ""
echo "1. Create account: https://physionet.org/register/"
echo "2. Complete CITI training: https://physionet.org/about/citi-course/"
echo "3. Request access: https://physionet.org/content/mimic-iv-demo-omop/0.9/"
echo "4. Accept data use agreement"
echo ""
echo -e "${YELLOW}Note:${NC} The demo dataset is publicly available after credentialing."
echo ""

# Check for wget or curl
if command -v wget &> /dev/null; then
    DOWNLOAD_CMD="wget"
    DOWNLOAD_OPTS="-q --show-progress"
elif command -v curl &> /dev/null; then
    DOWNLOAD_CMD="curl"
    DOWNLOAD_OPTS="-L -O"
else
    echo -e "${RED}✗ Error: Neither wget nor curl found${NC}"
    echo "  Please install wget or curl to download data"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Download Method"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Choose download method:"
echo ""
echo "  1) Direct download (requires PhysioNet credentials)"
echo "  2) Manual instructions (for credentialed access)"
echo "  3) Cancel"
echo ""
read -p "Select option [1-3]: " -n 1 -r
echo ""

case $REPLY in
    1)
        echo ""
        echo -e "${BLUE}Direct Download Selected${NC}"
        echo ""
        
        # PhysioNet base URL for MIMIC-IV demo OMOP
        BASE_URL="https://physionet.org/files/mimic-iv-demo-omop/0.9"
        
        # List of OMOP CDM tables to download
        TABLES=(
            "person"
            "visit_occurrence"
            "visit_detail"
            "condition_occurrence"
            "drug_exposure"
            "procedure_occurrence"
            "device_exposure"
            "measurement"
            "observation"
            "death"
            "note"
            "note_nlp"
            "specimen"
            "fact_relationship"
            "location"
            "care_site"
            "provider"
            "payer_plan_period"
            "cost"
            "drug_era"
            "dose_era"
            "condition_era"
            "metadata"
            "cdm_source"
            "vocabulary"
            "concept"
            "concept_relationship"
            "concept_ancestor"
            "concept_synonym"
            "concept_class"
            "domain"
            "relationship"
        )
        
        echo "Downloading OMOP CDM tables..."
        echo ""
        
        cd "$DATA_DIR"
        
        SUCCESS_COUNT=0
        FAIL_COUNT=0
        
        for table in "${TABLES[@]}"; do
            FILE_NAME="${table}.csv"
            FILE_URL="${BASE_URL}/${FILE_NAME}"
            
            echo -n "  Downloading ${FILE_NAME}... "
            
            if [ "$DOWNLOAD_CMD" = "wget" ]; then
                if wget -q "$FILE_URL" 2>/dev/null; then
                    echo -e "${GREEN}✓${NC}"
                    ((SUCCESS_COUNT++))
                else
                    echo -e "${YELLOW}⚠ Not available${NC}"
                    ((FAIL_COUNT++))
                fi
            else
                if curl -f -s -L -O "$FILE_URL" 2>/dev/null; then
                    echo -e "${GREEN}✓${NC}"
                    ((SUCCESS_COUNT++))
                else
                    echo -e "${YELLOW}⚠ Not available${NC}"
                    ((FAIL_COUNT++))
                fi
            fi
        done
        
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Download Summary"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "  Successfully downloaded: ${SUCCESS_COUNT} files"
        echo "  Not available/optional:  ${FAIL_COUNT} files"
        echo ""
        
        if [ $SUCCESS_COUNT -eq 0 ]; then
            echo -e "${RED}✗ Download failed${NC}"
            echo ""
            echo "This may be due to:"
            echo "  1. Missing PhysioNet credentials"
            echo "  2. Need to accept data use agreement"
            echo "  3. Network issues"
            echo ""
            echo "Please use Option 2 (Manual instructions) or visit:"
            echo "  https://physionet.org/content/mimic-iv-demo-omop/0.9/"
            echo ""
            exit 1
        fi
        
        # Verify essential tables
        ESSENTIAL_TABLES=("person" "visit_occurrence" "condition_occurrence")
        MISSING_ESSENTIAL=0
        
        for table in "${ESSENTIAL_TABLES[@]}"; do
            if [ ! -f "${table}.csv" ]; then
                echo -e "${RED}✗ Missing essential table: ${table}.csv${NC}"
                ((MISSING_ESSENTIAL++))
            fi
        done
        
        if [ $MISSING_ESSENTIAL -gt 0 ]; then
            echo ""
            echo -e "${RED}✗ Essential tables missing. Download incomplete.${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✓ Download complete!${NC}"
        echo ""
        echo "Data saved to: $DATA_DIR"
        echo ""
        ;;
        
    2)
        echo ""
        echo -e "${BLUE}Manual Download Instructions${NC}"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Steps to manually download MIMIC-IV Demo OMOP data:"
        echo ""
        echo "1. Visit: https://physionet.org/content/mimic-iv-demo-omop/0.9/"
        echo ""
        echo "2. Log in with PhysioNet credentials"
        echo ""
        echo "3. Accept the data use agreement (if not already done)"
        echo ""
        echo "4. Download the ZIP file or individual CSV files"
        echo ""
        echo "5. Extract to: $DATA_DIR"
        echo ""
        echo "Required files (essential):"
        echo "  - person.csv"
        echo "  - visit_occurrence.csv"
        echo "  - condition_occurrence.csv"
        echo "  - drug_exposure.csv"
        echo "  - procedure_occurrence.csv"
        echo "  - measurement.csv"
        echo ""
        echo "Optional files (vocabulary):"
        echo "  - vocabulary.csv, concept.csv, etc."
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Alternative: Use wget with credentials"
        echo ""
        echo "  wget -r -N -c -np --user=USERNAME --ask-password \\"
        echo "    https://physionet.org/files/mimic-iv-demo-omop/0.9/ \\"
        echo "    -P $DATA_DIR"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        exit 0
        ;;
        
    3)
        echo ""
        echo "Download cancelled."
        echo ""
        exit 0
        ;;
        
    *)
        echo ""
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

# Display file info
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Downloaded Files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
ls -lh "$DATA_DIR"/*.csv 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
echo ""

# Check person.csv for patient count
if [ -f "$DATA_DIR/person.csv" ]; then
    PATIENT_COUNT=$(tail -n +2 "$DATA_DIR/person.csv" | wc -l | tr -d ' ')
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Dataset Information"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  Patients: $PATIENT_COUNT"
    echo "  Format:   OMOP CDM v5.3"
    echo "  Source:   MIMIC-IV demo"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Next Steps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Split data into federated sites:"
echo ""
echo "   cd research/data-generation"
echo "   npm install  # if not already done"
echo "   node split-omop-csv.js \\"
echo "     --input omop-data/mimic-demo/ \\"
echo "     --output splits/mimic-demo/ \\"
echo "     --num-sites 3 \\"
echo "     --scenario icu"
echo ""
echo "2. Run experiments:"
echo ""
echo "   cd research/experiments"
echo "   bash run-all-assumptions.sh mimic-demo icu"
echo ""
echo "3. View results:"
echo ""
echo "   cat ../data-generation/results/mimic-demo/icu/comparison.txt"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""

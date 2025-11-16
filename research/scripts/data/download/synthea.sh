#!/bin/bash
# Download Pre-generated Synthea Data from S3
#
# This script downloads pre-generated synthetic OMOP data from S3,
# saving 15-30 minutes of data generation time.
#
# Usage:
#   ./download-synthea-data.sh [scales...]
#
# Examples:
#   ./download-synthea-data.sh              # Download all scales
#   ./download-synthea-data.sh 500k 1m      # Download specific scales
#   ./download-synthea-data.sh --help       # Show help

set -e  # Exit on error

# S3 bucket configuration (AWS Open Data Registry - Public)
S3_BUCKET="s3://synthea-omop"
S3_NO_SIGN_REQUEST="--no-sign-request"  # Public bucket, no auth needed

# Available scales (only 3 public datasets available)
SCALES=("1k" "100k" "2.3m")

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
show_help() {
  cat << EOF
📦 Download Pre-generated Synthea Data from S3

This script downloads pre-generated synthetic OMOP data, saving 15-30 minutes
of data generation time.

USAGE:
  $0 [OPTIONS] [SCALES...]

OPTIONS:
  --help, -h          Show this help message
  --list              List available scales in S3
  --force             Overwrite existing data
  --no-verify         Skip data integrity verification

SCALES:
  1k, 100k, 2.3m (default: all)
  Note: These are from AWS Open Data Registry (public, no auth required)

EXAMPLES:
  $0                  # Download all scales (1k, 100k, 2.3m)
  $0 100k 2.3m        # Download only 100k and 2.3m
  $0 --force 2.3m     # Re-download 2.3m, overwriting existing
  $0 --list           # List what's available in S3

S3 BUCKET:
  ${S3_BUCKET}/ (AWS Open Data Registry - Public)

LOCAL OUTPUT:
  research/data-generation/omop-data/synthea{scale}/

REQUIREMENTS:
  - AWS CLI installed
  - NO credentials needed (public bucket)
  - ~2GB free disk space (for all scales: 1k=30MB, 100k=300MB, 2.3m=1.5GB)

WHAT'S DOWNLOADED:
  - Raw OMOP CDM CSV files (condition_occurrence.csv, drug_exposure.csv, 
    measurement.csv, observation.csv, person.csv, procedure_occurrence.csv, 
    visit_occurrence.csv, etc.)

DOWNLOAD TIME:
  - 1k: ~5 seconds (~30MB)
  - 100k: ~30 seconds (~300MB compressed)
  - 2.3m: ~5-10 minutes (~1.5GB compressed, 40+ files)
  - All scales: ~10-15 minutes

NOTES FOR 2.3M DATASET:
  - Large download (1.5GB+), requires stable internet connection
  - Automatically retries up to 3 times if interrupted
  - Uses aws s3 sync which supports resume
  - After download: auto-decompresses LZO files and merges split CSVs
  
TROUBLESHOOTING:
  If download fails or network times out:
  1. Run: $0 --force 2.3m (download only 2.3m dataset)
  2. Or download in stages: 1k → 100k → 2.3m separately
  3. Check network stability and available disk space (~2GB needed)
EOF
}

list_s3_data() {
  echo -e "${BLUE}📋 Listing available data in S3...${NC}"
  echo ""
  aws s3 ls ${S3_NO_SIGN_REQUEST} "${S3_BUCKET}/" --recursive --human-readable | head -50 || {
    echo -e "${RED}❌ Failed to list S3 bucket.${NC}"
    exit 1
  }
}

check_aws_cli() {
  if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not installed.${NC}"
    echo ""
    echo "Please install AWS CLI:"
    echo "  https://aws.amazon.com/cli/"
    echo ""
    echo "Or use package manager:"
    echo "  brew install awscli       # macOS"
    echo "  apt install awscli        # Ubuntu/Debian"
    echo "  yum install aws-cli       # Amazon Linux"
    exit 1
  fi
  echo -e "${GREEN}✅ AWS CLI found: $(aws --version | head -1)${NC}"
  echo -e "${GREEN}✅ Using public bucket (no credentials required)${NC}"
}

check_lzop() {
  if ! command -v lzop &> /dev/null; then
    echo -e "${YELLOW}⚠️  lzop not found - will need to decompress .lzo files${NC}"
    echo ""
    echo "To decompress .lzo files, install lzop:"
    echo "  brew install lzop         # macOS"
    echo "  apt install lzop          # Ubuntu/Debian"
    echo "  yum install lzop          # Amazon Linux"
    echo ""
    return 1
  fi
  echo -e "${GREEN}✅ lzop found: $(lzop --version 2>&1 | head -1)${NC}"
  return 0
}

decompress_lzo_files() {
  local dir=$1
  echo -e "${BLUE}   🔓 Decompressing LZO files...${NC}"
  
  local lzo_files=$(find "$dir" -name "*.lzo" 2>/dev/null | wc -l || echo "0")
  if [ "$lzo_files" -eq 0 ]; then
    echo "   No LZO files to decompress"
    return 0
  fi
  
  if ! command -v lzop &> /dev/null; then
    echo -e "${YELLOW}   ⚠️  Skipping decompression (lzop not installed)${NC}"
    echo "   Files remain compressed as .lzo"
    return 0
  fi
  
  local count=0
  # Find all .lzo files recursively
  while IFS= read -r -d '' lzo_file; do
    if lzop -d "$lzo_file" 2>/dev/null; then
      count=$((count + 1))
    fi
  done < <(find "$dir" -name "*.lzo" -print0 2>/dev/null)
  
  # Also try direct pattern matching for immediate children
  for lzo_file in "$dir"/*.lzo; do
    [ -e "$lzo_file" ] || continue
    if lzop -d "$lzo_file" 2>/dev/null; then
      count=$((count + 1))
    fi
  done
  
  echo -e "${GREEN}   ✅ Decompressed ${count} files${NC}"
  return 0
}

merge_split_files() {
  local dir=$1
  echo -e "${BLUE}   🔗 Merging split CSV files...${NC}"
  
  # Find all base filenames (without .0, .1, .2, etc.)
  local base_files=$(find "$dir" -type f \( -name "*.csv.[0-9]" -o -name "*.csv.[0-9][0-9]" \) 2>/dev/null | \
    sed 's/\.[0-9][0-9]*$//' | sort -u || echo "")
  
  if [ -z "$base_files" ]; then
    echo "   No split files to merge"
    return 0
  fi
  
  local merged_count=0
  for base_file in $base_files; do
    local output_file="${base_file}"
    local split_files=("${base_file}".[0-9]*)
    
    if [ ${#split_files[@]} -gt 0 ] && [ -e "${split_files[0]}" ]; then
      echo "      Merging: $(basename "$base_file")"
      
      # Merge files (first file with header, rest without header)
      if cat "${split_files[0]}" > "$output_file" 2>/dev/null; then
        for split_file in "${split_files[@]:1}"; do
          tail -n +2 "$split_file" >> "$output_file" 2>/dev/null || true
        done
        
        # Remove split files
        rm -f "${split_files[@]}" 2>/dev/null || true
        ((merged_count++)) || true
      fi
    fi
  done
  
  echo -e "${GREEN}   ✅ Merged ${merged_count} split files${NC}"
  return 0
}

download_scale() {
  local scale=$1
  local force=$2
  
  # Map scale to S3 directory name (2.3m -> 23m)
  local s3_scale="${scale}"
  if [ "$scale" = "2.3m" ]; then
    s3_scale="23m"
  fi
  
  local output_dir="research/data-generation/omop-data/synthea${scale}"
  local s3_path="${S3_BUCKET}/synthea${s3_scale}/"
  
  echo -e "${BLUE}📦 Downloading ${scale} dataset...${NC}"
  
  # Check if already exists
  if [ -d "$output_dir" ] && [ "$force" != "true" ]; then
    echo -e "${YELLOW}⚠️  ${output_dir} already exists. Skipping.${NC}"
    echo "   Use --force to overwrite."
    return 0
  fi
  
  # Create output directory
  mkdir -p "$output_dir"
  
  # Download from S3 (public bucket, no credentials needed)
  echo "   Source: ${s3_path}"
  echo "   Target: ${output_dir}"
  
  # Show different messages based on scale
  if [ "$scale" = "2.3m" ]; then
    echo "   ⏳ Large download (~1.5GB, 40+ files), this will take 5-10 minutes..."
    echo "   Progress will be shown below:"
    echo ""
  else
    echo "   This may take a few moments..."
  fi
  
  # Use progress display for large datasets, quiet for small ones
  local aws_flags="${S3_NO_SIGN_REQUEST}"
  if [ "$scale" = "2.3m" ]; then
    # Show progress for large downloads
    aws_flags="${S3_NO_SIGN_REQUEST}"
  else
    # Quiet mode for small downloads
    aws_flags="${S3_NO_SIGN_REQUEST} --only-show-errors --no-progress"
  fi
  
  # Retry up to 3 times
  local max_retries=3
  local retry_count=0
  local download_success=false
  
  while [ $retry_count -lt $max_retries ]; do
    if [ $retry_count -gt 0 ]; then
      echo ""
      echo "   Retry attempt $retry_count/$max_retries..."
      sleep 2
    fi
    
    if aws s3 sync $aws_flags "${s3_path}" "${output_dir}" 2>&1; then
      download_success=true
      break
    else
      retry_count=$((retry_count + 1))
      echo -e "${YELLOW}   ⚠️  Download interrupted, retrying...${NC}"
    fi
  done
  
  if [ "$download_success" = true ]; then
    echo -e "${GREEN}   ✅ Downloaded successfully${NC}"
    
    # Check for LZO files and decompress if needed
    local has_lzo=$(find "${output_dir}" -name "*.lzo" 2>/dev/null | head -1 || echo "")
    if [ -n "$has_lzo" ]; then
      echo -e "${BLUE}   🔍 Found LZO files, decompressing...${NC}"
      decompress_lzo_files "${output_dir}" || true
    else
      echo "   No LZO files to decompress"
    fi
    
    # Check for split files and merge if needed
    local has_split=$(find "${output_dir}" -name "*.csv.[0-9]*" 2>/dev/null | head -1 || echo "")
    if [ -n "$has_split" ]; then
      echo -e "${BLUE}   🔍 Found split files, merging...${NC}"
      merge_split_files "${output_dir}" || true
    else
      echo "   No split files to merge"
    fi
    
    # Count CSV files
    local csv_count=$(find "${output_dir}" -name "*.csv" -not -name "*.csv.[0-9]*" 2>/dev/null | wc -l)
    
    if [ "$csv_count" -gt 0 ]; then
      echo -e "${GREEN}   ✅ Verified: ${csv_count} CSV files found${NC}"
      
      # Try to find and count patients (person.csv or PERSON.csv)
      local person_file=""
      if [ -f "${output_dir}/person.csv" ]; then
        person_file="${output_dir}/person.csv"
      elif [ -f "${output_dir}/PERSON.csv" ]; then
        person_file="${output_dir}/PERSON.csv"
      fi
      
      if [ -n "$person_file" ]; then
        local person_count=$(wc -l < "$person_file" 2>/dev/null || echo "1")
        local person_count=$((person_count - 1))  # Subtract header
        echo "   📊 Summary:"
        echo "      Patients: ${person_count}"
        echo "      Files: ${csv_count} CSV tables"
      else
        echo "   📊 Summary:"
        echo "      Files: ${csv_count} CSV tables"
        echo "      (person.csv not found for patient count)"
      fi
    else
      echo -e "${YELLOW}   ⚠️  Warning: No CSV files found${NC}"
      echo "   Directory may contain compressed (.lzo) files"
      # Don't fail, just warn
    fi
  else
    echo -e "${RED}   ❌ Download failed${NC}"
    return 1
  fi
  
  echo ""
}

# Main script
# Get the script's directory and navigate to project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "${SCRIPT_DIR}/../../.." && pwd )"
cd "${PROJECT_ROOT}"

echo -e "${BLUE}Working directory: $(pwd)${NC}"

# Parse arguments
FORCE=false
VERIFY=true
REQUESTED_SCALES=()

while [[ $# -gt 0 ]]; do
  case $1 in
    --help|-h)
      show_help
      exit 0
      ;;
    --list)
      check_aws_credentials
      list_s3_data
      exit 0
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --no-verify)
      VERIFY=false
      shift
      ;;
    1k|100k|2.3m)
      REQUESTED_SCALES+=("$1")
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information."
      exit 1
      ;;
  esac
done

# If no scales specified, download all
if [ ${#REQUESTED_SCALES[@]} -eq 0 ]; then
  REQUESTED_SCALES=("${SCALES[@]}")
fi

# Check AWS CLI
check_aws_cli

# Check lzop (optional, warn if not found)
check_lzop || echo ""

# Print header
echo ""
echo "================================================"
echo "📦 Synthea Data Downloader from S3"
echo "================================================"
echo ""
echo "S3 Bucket: ${S3_BUCKET}/ (AWS Open Data Registry - Public)"
echo "Scales: ${REQUESTED_SCALES[*]}"
echo "Force: ${FORCE}"
echo "Authentication: Not required (public bucket)"
echo ""

# Download each scale
SUCCESS_COUNT=0
FAIL_COUNT=0

for scale in "${REQUESTED_SCALES[@]}"; do
  if download_scale "$scale" "$FORCE"; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

# Summary
echo "================================================"
echo ""
if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "${GREEN}✅ All downloads completed successfully!${NC}"
  echo "   Downloaded: ${SUCCESS_COUNT}/${#REQUESTED_SCALES[@]} scales"
else
  echo -e "${YELLOW}⚠️  Some downloads failed${NC}"
  echo "   Success: ${SUCCESS_COUNT}"
  echo "   Failed: ${FAIL_COUNT}"
  exit 1
fi

echo ""
echo "📁 Data location: research/data-generation/omop-data/"
echo ""
echo "🚀 Next steps:"
echo "   1. Run validation:"
echo "      npx ts-node research/data-generation/run-large-scale-validation.ts"
echo ""
echo "   2. Or use complete pipeline:"
echo "      ./research/data-generation/complete-scale-validation.sh"
echo ""

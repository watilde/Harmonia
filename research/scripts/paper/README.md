# Paper Generation Scripts

Scripts for generating publication-ready materials.

## Quick Start

```bash
# Generate scalability plots only
npm run paper:plots

# Generate complete PDF with figures
npm run paper:pdf
```

## What Gets Generated

### Scalability Plots (`paper:plots`)

Creates two figures in `research/paper/figures/`:

1. **scalability_validation.png**
   - Log-log plot: Processing time vs cohort size
   - Compares observed performance with O(N) and O(N log N) references
   - Shows 1k, 100k, 2.8m patient measurements

2. **efficiency_improvement.png**
   - Per-patient processing time vs cohort size
   - Demonstrates efficiency improvement with scale (1.0μs → 0.22μs)
   - Illustrates amortized I/O overhead

### PDF Generation (`paper:pdf`)

Creates `research/paper/manuscript_v5.4_implementation_corrected.pdf`:

- ✅ Complete manuscript with all sections
- ✅ Table of contents with numbered sections
- ✅ Embedded scalability figures (high-res 300dpi)
- ✅ Syntax-highlighted code blocks
- ✅ Properly formatted tables and equations
- ✅ Blue hyperlinks for references

## Requirements

### For Plots

```bash
pip install matplotlib numpy
```

### For PDF

**macOS:**

```bash
brew install pandoc basictex
```

**Ubuntu/Debian:**

```bash
sudo apt install pandoc texlive-latex-base texlive-latex-extra texlive-xetex
```

**Check installation:**

```bash
pandoc --version
python3 -c "import matplotlib; print('✓ matplotlib')"
```

## File Structure

```
research/
├── paper/
│   ├── manuscript_v5.4_implementation_corrected.md (source)
│   ├── manuscript_v5.4_implementation_corrected.pdf (generated)
│   └── figures/
│       ├── scalability_validation.png (generated)
│       └── efficiency_improvement.png (generated)
├── scripts/
│   ├── paper/
│   │   ├── generate-scalability-plots.py
│   │   ├── generate-pdf.sh
│   │   └── README.md (this file)
│   └── data-generation/
│       └── results/
│           └── large-scale-validation/
│               └── validation-results.json (data source)
```

## Customization

### Adjust Plot Appearance

Edit `generate-scalability-plots.py`:

- Line 27-28: Figure size `figsize=(12, 5)`
- Line 31: Plot markers and colors `'bo-'`
- Line 58: DPI for export `dpi=300`

### Adjust PDF Layout

Edit `generate-pdf.sh`:

- Line 52: Margins `geometry:margin=1in`
- Line 53: Font size `fontsize=11pt`
- Line 56-58: Table of contents depth `toc-depth=3`

## Troubleshooting

**"pandoc: command not found"**

- Install pandoc: https://pandoc.org/installing.html

**"ModuleNotFoundError: No module named 'matplotlib'"**

```bash
pip install matplotlib numpy
```

**"! LaTeX Error: File 'xelatex' not found"**

- Install XeLaTeX:
  - macOS: `brew install basictex && sudo tlmgr update --self && sudo tlmgr install xetex`
  - Ubuntu: `sudo apt install texlive-xetex`

**Figures not showing in PDF**

- Check that figures were generated: `ls paper/figures/*.png`
- Run plots first: `npm run paper:plots`
- Verify paths in generate-pdf.sh match actual figure locations

## Development

To regenerate everything after data updates:

```bash
# 1. Run validation (updates validation-results.json)
npm run paper:scalability

# 2. Generate plots from new data
npm run paper:plots

# 3. Generate PDF with new plots
npm run paper:pdf
```

## Notes

- Plots use validation results from `scripts/data-generation/results/large-scale-validation/validation-results.json`
- PDF includes figures automatically inserted after Section 3.10
- Temporary markdown file with figures is created at `/tmp/manuscript_with_figures.md` (auto-deleted)
- Original manuscript markdown is never modified

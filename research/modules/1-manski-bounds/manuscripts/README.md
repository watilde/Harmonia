# Paper - Federated Partial Identification

Manuscript and figures for federated causal inference using Manski bounds.

---

## 📄 Files

- **`manuscript_v6.0.md`** (72KB) - Main manuscript
- **`manuscript_v6.0.pdf`** (617KB) - PDF version
- **`figures/`** - Publication figures
  - `scalability_validation.png` (314KB)
  - `efficiency_improvement.png` (159KB)

---

## 🎯 Key Contributions

1. **Federated Aggregation Theorem**: Preserves identified sets across sites
2. **O(N) Scalability**: 617ms for 2.8M patients
3. **Privacy-Preserving**: Only 3 numbers shared per site
4. **OMOP CDM Integration**: Disease-agnostic, standards-compliant
5. **Real Data Validation**: MIMIC-IV Demo (100 ICU patients)

---

## 📈 Results

**Scalability** (Synthea OMOP CDM):

| Dataset      | Patients  | Bounds Time | Per-Patient |
| ------------ | --------- | ----------- | ----------- |
| Synthea-1k   | 1,000     | 1ms         | 1.0μs       |
| Synthea-100k | 100,000   | 45ms        | 0.45μs      |
| Synthea-2.8m | 2,800,000 | 617ms       | 0.22μs      |

**Validation** (Monte Carlo, 1,000 iterations):

- Worst-case: 100% coverage
- MTR: 99.1% coverage
- MTS: 97.8% coverage
- MTR+MTS: 98.5% coverage

**Real Data** (MIMIC-IV Demo, 100 ICU patients):

- MTR+MTS: 73% width reduction vs worst-case

---

## 🔬 Methods

**Partial Identification**:

- Manski bounds (worst-case, MTR, MTS, MTR+MTS)
- Federated aggregation via weighted averaging
- Privacy-preserving: share only 3 summary statistics per site

**Data**:

- OMOP Common Data Model v5.3
- Synthea synthetic EHR (AWS S3: 1k, 100k, 2.8M patients)
- MIMIC-IV demo (real ICU data)

**Implementation**: TypeScript/Node.js

---

## 🚀 Generate PDF (Node.js)

```bash
cd research/modules/1-manski-bounds
npm run paper:pdf
```

**Features**:

- Math rendering with KaTeX
- Syntax highlighting with highlight.js
- Puppeteer-based PDF generation
- No external dependencies (pandoc, LaTeX)

---

## 📊 Regenerate Figures (Node.js)

```bash
cd research/modules/1-manski-bounds
npm run data:validate   # build validation results
npm run paper:plots     # regenerate figures
```

**Features**:

- Chart.js-based plotting
- High-resolution PNG output (300 DPI)
- No Python dependencies

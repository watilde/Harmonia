# Federated Causal Diagnostics: Testing Assumption Quality Across Sites

**Author**: Daijiro Wachi (Independent OSS Engineer)  
**Code**: https://github.com/watilde/Harmonia

---

## Abstract

I built an open-source tool for diagnosing causal inference assumptions in federated settings. **One claim: diagnostic scores (0-1 scale) can be computed with O(n) scaling and constant 150-byte communication, though exploratory thresholds (>0.8 for point estimation, 0.5-0.8 for bounds) lack empirical calibration.** Tested on 1,130-2,709,803 synthetic patients. Scores ranged 0.86-1.00 at 1k scale (CV=7.2%), converging at larger scales.

**Note**: This demonstrates computational feasibility using synthetic Synthea data. Threshold validation and real-world testing require institutional collaboration.

---

## 1. What I Built

A TypeScript tool that diagnoses three causal inference assumptions:

**1. Unconfoundedness** (no unmeasured confounding):
- Standardized Mean Difference (SMD)
- Propensity score overlap
- Residual correlation

**2. Positivity** (common support):
- Tail mass (extreme propensity scores)
- Effective sample size

**3. Specification** (model fit):
- R² (outcome model)
- AUC (treatment model)
- Calibration

**Scoring**: Each dimension → [0,1] score. Overall score = geometric mean.

**Communication**: Each site transmits 3 scores (24 bytes) + metadata = 50 bytes/site.

---

## 2. Test Results (Synthetic Data)

**Table 1: Diagnostic Scores Across Three Scales**

| Scale | Patients | Site 1 | Site 2 | Site 3 | Federated | CV | Processing |
|-------|----------|--------|--------|--------|-----------|-----|------------|
| 1k    | 1,130    | 0.95   | 0.86   | 1.00   | 0.95      | 7.2% | <1s       |
| 100k  | 235,222  | 0.97   | 0.96   | 0.97   | 0.97      | 0.5% | 3s        |
| 2.8m  | 2,709,803| 0.98   | 0.97   | 0.98   | 0.98      | 0.5% | 13s       |

**Key finding**: All scores >0.8 (exploratory "safe" threshold), but threshold lacks calibration. Site heterogeneity (CV=7.2% at 1k) diminishes at scale (CV=0.5% at 2.8m).

**Computational performance:**
- Overhead: ~30% added to baseline causal inference
- Scaling: Linear O(n) complexity
- Memory: 2-3 GB per site

**Communication:**
- Per site: 50 bytes (3 scores × 8 bytes + metadata)
- Total: 150 bytes for 3 sites (constant across scales)
- Reduction: 1k (1,340×), 100k (279,000×), 2.8m (3,200,000×)

---

## 3. Exploratory Thresholds (Unvalidated)

**Proposed decision rules** (require calibration):

| Overall Score | Suggested Method | Interpretation |
|--------------|------------------|----------------|
| ≥ 0.8        | Point estimation | Assumptions likely satisfied |
| 0.5 - 0.8    | Partial ID bounds | Moderate concern |
| < 0.5        | Sensitivity analysis | Severe violations |

**Critical caveat**: These thresholds are **exploratory proposals**, not validated cutoffs. They require calibration via:
1. Controlled studies with known violations
2. Comparison to RCT ground truth
3. Empirical assessment of Type I/II error rates

**Example (1k scale)**: Federated score = 0.95 suggests point estimation, but in real data this might be overconfident if diagnostics miss subtle violations.

---

## 4. How Scores Are Computed

**Unconfoundedness score** (0-1):
```
smd = max standardized mean difference across covariates
overlap = overlap coefficient of propensity distributions
residual_cor = correlation(outcome residuals, treatment residuals | covariates)

score = (1 - |smd|) × overlap × (1 - |residual_cor|)
```

**Positivity score** (0-1):
```
tail_mass = fraction with propensity <0.1 or >0.9
ess = effective sample size / n

score = (1 - tail_mass) × sqrt(ess)
```

**Specification score** (0-1):
```
r_squared = outcome model R²
auc = treatment model AUC
calibration = Hosmer-Lemeshow p-value

score = (r_squared + auc + calibration_indicator) / 3
```

**Overall score**: Geometric mean of three dimensions.

---

## 5. Limitations

**Threshold calibration**: The 0.8 and 0.5 cutoffs are **not derived from empirical studies**. They are exploratory proposals requiring validation via controlled experiments with known assumption violations.

**Synthetic data paradox**: Synthea data has known causal structure, making it impossible to test diagnostic accuracy for real violations. We can verify *computational feasibility*, not *diagnostic validity*.

**Diagnostic accuracy unknown**: We don't know:
- Sensitivity: Can diagnostics detect violations?
- Specificity: Do they produce false alarms?
- Calibration: Do scores correlate with bias magnitude?

**Information leakage**: Diagnostic scores reveal data quality indirectly. High scores suggest good covariate balance; low scores suggest treatment imbalance or poor model fit. This is partial privacy (better than sharing raw data, worse than zero disclosure).

**Three sites only**: Real networks have 10+ sites. Heterogeneity patterns may differ.

**Purpose**: This demonstrates **computational feasibility** (can we compute scores efficiently?), not **clinical validity** (should we trust these scores?).

---

## 6. Privacy Tradeoff

**What is protected**: Raw patient data and covariate identities (sites don't share individual records or variable lists).

**What is disclosed**: Diagnostic quality (scores indirectly reveal whether site has good balance, overlap, model fit).

**Example**: A score of 0.95 suggests strong covariate balance. A score of 0.60 suggests imbalance or model misspecification. Coordinators can infer data quality without seeing covariates.

**Trade-off**: This is inherent to diagnostic sharing. Hiding quality metrics would defeat the purpose of diagnostics.

---

## 7. Reproducibility

```bash
# Clone repository
git clone https://github.com/watilde/Harmonia
cd Harmonia

# Install dependencies
npm install

# Build packages
npm run build

# Run diagnostic tests
npm run test:diagnostics:1k
npm run test:diagnostics:100k
npm run test:diagnostics:2.8m
```

Results saved to `research/modules/3-design-failure-aware-causal/experiments/results/`

---

## 8. What This Demonstrates

✅ **Computational feasibility**: Diagnostics computed in seconds  
✅ **Communication efficiency**: 150 bytes (constant)  
✅ **Heterogeneity detection**: CV=7.2% at 1k, 0.5% at 2.8m  
✅ **Integration**: Works with existing causal inference pipeline  

❌ **Threshold validation**: 0.8/0.5 cutoffs lack calibration  
❌ **Diagnostic accuracy**: Unknown sensitivity/specificity  
❌ **Real violations**: Synthetic data can't test detection  
❌ **Clinical deployment**: Not ready without validation  

---

## 9. Seeking Collaboration

I am an independent OSS engineer without access to real clinical data. This tool needs validation via:

1. **Controlled studies**: Inject known violations, test detection
2. **RCT comparison**: Compare observational diagnostics to RCT outcomes
3. **Multi-site testing**: Test on 10+ real hospital networks

If you have OMOP-formatted data, IRB approval, and expertise in causal inference, I welcome collaboration.

**Contact**: daijiro.wachi@gmail.com

---

## References

1. Rosenbaum, P. R., & Rubin, D. B. (1983). The propensity score in observational studies. _Biometrika_, 70(1), 41-55.
2. Pearl, J. (2009). _Causality: Models, reasoning, and inference_. Cambridge University Press.
3. Stuart, E. A. (2010). Matching methods for causal inference. _Statistical Science_, 25(1), 1-21.
4. Petersen, M. L., et al. (2012). Diagnosing and responding to violations. _American Journal of Epidemiology_, 175(11), 1061-1071.
5. Austin, P. C. (2011). An introduction to propensity score methods. _Multivariate Behavioral Research_, 46(3), 399-424.



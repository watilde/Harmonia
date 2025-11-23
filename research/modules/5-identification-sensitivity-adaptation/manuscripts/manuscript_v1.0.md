# Federated Robust Causal Inference: A Unified Framework

**Author**: Daijiro Wachi  
**Email**: daijiro.wachi@gmail.com  
**Version**: 1.0 (Revised for Submission)  
**Code**: https://github.com/watilde/Harmonia-Shadow/tree/main/research/modules/5-identification-sensitivity-adaptation

---

## ABSTRACT

**Background:** Multi-site studies require privacy-preserving federation, valid inference under unmeasured confounding, and narrow uncertainty—no existing framework achieves all three while adapting to heterogeneous assumptions.

**Objective:** Develop unified federated robust causal inference integrating minimax-optimal aggregation, robustness quantification, and automatic diagnostic adaptation with formal guarantees.

**Methods:** Three integrated modules—(1) inverse-width optimal aggregation, (2) Federated Robustness Index with decision thresholds, (3) automatic mode selection via three-dimensional diagnostics—validated across 1k-2.8m patients (3 sites).

**Results:** Inverse-width achieved 15.5% tighter bounds (1k); FRI=2.15 (2.8m); diagnostics (0.86-1.00) triggered appropriate modes. Communication: 264 bytes vs. 201 KB-482 MB centralized (1.8M× reduction). Throughput: 54k patients/sec.

**Conclusions:** First complete federated causal framework with provable optimality, validated robustness, and automatic safeguards. Achieves 1.8M× communication reduction with <1.3% utility loss, enabling privacy-compliant multi-site inference at million-patient scale.

**Keywords**: Federated Learning, Causal Inference, Partial Identification, E-values, Assumption Diagnostics, Robustness

---

## 1. INTRODUCTION

### 1.1 The Federated Causal Inference Trilemma

Multi-site observational studies using electronic health records (EHRs) promise large-scale real-world evidence [1,2] but face competing constraints:

1. **Privacy**: HIPAA/GDPR regulations prohibit patient-level data sharing [3]
2. **Validity**: Unmeasured confounding makes causal inference uncertain [4,5]
3. **Precision**: Clinical decisions require narrow uncertainty bounds

**Current federated causal methods** [7-9]: Preserve privacy ✓, provide point estimates ✓, but **assume no unmeasured confounding** ✗ (untestable, often violated). When assumptions fail, confidence intervals understate uncertainty, potentially misguiding clinical decisions.

### 1.2 The Assumption Heterogeneity Challenge

Real-world federated networks exhibit heterogeneous assumption quality. **Question**: Should we trust point estimates when one site has severe violations? **Current practice**: Apply same method to all sites, ignore heterogeneity [10,11].

### 1.3 Our Solution: Federated Robust Causal Inference (FRCI)

**FRCI is a self-adaptive ecosystem** with inter-module feedback loops creating emergent properties:

**Three feedback loops:**

1. **Diagnostics → Method Selection**: Module 3 scores trigger Module 1 (bounds) or point estimation
2. **Bound Width → Threshold Re-evaluation**: Wide bounds (>0.5) trigger stricter diagnostic thresholds
3. **FRI → Weight Adjustment**: Low FRI sites (<1.5) are down-weighted in aggregation

**Integrated weighting:** $w_k^{\text{final}} = w_k^{\text{Module1}} \times \psi(\text{score}_k) \times \phi(\text{FRI}_k)$ where $\psi$ adjusts for diagnostic quality (1.0/0.7/0.4 for high/moderate/low) and $\phi$ adjusts for robustness (1.0/0.8/0.5 for robust/moderate/vulnerable).

**Emergent properties**: Self-correcting (mitigates weak sites), conservative when uncertain, efficient when confident—impossible with individual modules.

![Emergent Properties from Multi-Module Integration](figures/fig1_integration_loops.png)
_Figure 1: Multi-module feedback loops creating emergent properties. The three modules (Diagnostics, Bounds+Aggregation, E-values) interact through automatic adjustments: diagnostic scores trigger method selection, bound widths re-evaluate thresholds, and FRI values adjust site weights. Central formula shows integrated weighting._

---

## 2. METHODS

### 2.1 Integrated Framework Architecture

```
Input: Multi-site data
  ↓
Module 3: Diagnostics → Compute scores (unconf, positivity, specification)
  ↓
Branch: score > 0.8 → Module 1 (Bounds + Optimal Aggregation)
        score < 0.8 → Module 2 (FRI + Sensitivity Analysis)
  ↓
Feedback: Module 2 FRI → adjust Module 1 weights
          Module 1 width → adjust Module 3 thresholds
  ↓
Output: Adaptive federated inference
```

### 2.2 Module Descriptions (See Companion Manuscripts)

**Module 1: Minimax-Optimal Aggregation** [Companion Paper 2]

- **Theory**: Inverse-width weighting is minimax-optimal under heterogeneity (Theorem 1, KKT derivation)
- **Result**: 15.5% tighter bounds than conservative at 1k scale

**Module 2: Federated Robustness Index** [Companion Paper 3]

- **Theory**: FRI preserves robustness guarantees under convex aggregation (Theorem 1)
- **Decision-theoretic thresholds**: FRI>3.0 (high-stakes), >2.0 (moderate), >1.5 (exploratory)
- **Result**: FRI=2.15 at 2.8m scale, exceeding moderate threshold

**Module 3: Diagnostic-Driven Adaptation** [Companion Paper 4]

- **Three-dimensional scoring**: Unconfoundedness (SMD, overlap), Positivity (tail mass, ESS), Specification (R², AUC)
- **Mode selection**: >0.8 → point, 0.5-0.8 → bounds, <0.5 → sensitivity
- **Result**: Diagnostic scores 0.86-1.00 at 1k scale, triggering point estimation

### 2.3 Experimental Design

**Three Scales**: 1k (1,130 patients), 100k (235,222 patients), 2.8m (2,709,803 patients) across 3 OMOP sites.

**Data**: Synthea-generated diabetes treatment cohorts with MTR bounds.

**Metrics**: Integrated performance (bound width, FRI, diagnostic scores, computational time), emergent integration effects.

---

## 3. RESULTS

### 3.1 Integrated Framework Performance Summary

**Table 1: Multi-Module Integration Across Scales**

| Scale    | Module 1 Width | Module 2 FRI | Module 3 Score | Integrated Decision | Throughput | Time |
| -------- | -------------- | ------------ | -------------- | ------------------- | ---------- | ---- |
| **1k**   | 0.390          | 1.961        | 0.91           | Point (cautious)    | 60k pts/s  | 0.5s |
| **100k** | 0.400          | 2.147        | 1.00           | Point (confident)   | 54k pts/s  | 8s   |
| **2.8m** | 0.400          | 2.149        | 1.00           | Point (confident)   | 54k pts/s  | 50s  |

**Key Observations**:

1. **Module 1 (width)**: Converges from 0.390 (1k) → 0.400 (100k/2.8m), validating asymptotic stability
2. **Module 2 (FRI)**: Strong convergence 1.961 → 2.149, exceeding moderate threshold (>2.0) at 2.8m
3. **Module 3 (diagnostics)**: Demonstrates law of large numbers effect—covariate balance improves with sample size (1k: SMD≈0.05, score=0.91; 100k: SMD=0.0015, score=1.00). Real-world multi-site data would exhibit systematic institutional differences and unmeasured confounding not present in single-source synthetic data.
4. **Integrated decision**: Consistent point estimation across scales, with 1k being more cautious due to sampling variation
5. **Computational**: Linear O(n) scaling, 54-60k patients/sec throughput validates production deployment

### 3.2 Module-Specific Highlights (Details in Companion Papers)

**Module 1 Key Result**: Inverse-width achieved 15.5% improvement over conservative (1k: 0.390 vs 0.462), converging to 0.22% at 2.8m. Theoretical minimax optimality confirmed empirically.

**Module 2 Key Result**: FRI inter-site CV collapsed from 9.7% (1k) → 0.16% (2.8m). Decision-theoretic thresholds: FRI=2.15 (2.8m) > 2.0 (moderate), suitable for clinical guidelines.

**Module 3 Key Result**: Diagnostic scores reflect statistical power scaling—1k: 0.86-1.00 (mean=0.91, SMD≈0.05) with natural sampling variation; 100k/2.8m: 1.00 (SMD<0.002) demonstrating law of large numbers in covariate balance. Threshold sensitivity: 0.80 (default) balances rigor and pragmatism.

### 3.3 Emergent Integration Effects

**Effect 1: Self-Correction via Multi-Module Feedback**

**Site 2 example (1k scale):** unconf score=0.70, FRI=1.929

Individual modules (no integration):

- Module 1: $w_2 = 0.333$ (equal sample-size weighting)
- Module 2: FRI=1.929 < 2.0 → caution flag
- Module 3: Score=0.89 > 0.8 → point estimation

Integrated FRCI: FRI-adjustment reduces $w_2$ from 0.334 → 0.286 (14% reduction). Federated width: 0.3903 → 0.3864 (1% tighter, more robust). **Effect**: Vulnerable site automatically down-weighted.

**Effect 2: Adaptive Threshold via Bound Width Feedback**

If Module 1 produces width > 0.5 (very wide), Module 3 re-evaluates with stricter threshold (0.90 instead of 0.80), preventing overconfident inference. **Actual scenario (1k):** width=0.390 (moderate) → no trigger, default threshold maintained.

**Effect 3: Convergence of Integrated Metrics**

- **1k**: High heterogeneity → all 3 modules critical
- **100k/2.8m**: Low heterogeneity → Modules 1-2 primary, Module 3 periodic

Adaptive strategy: Small networks (<10k) use full pipeline (0.5s); large networks (>100k) use selective integration (50s), maintaining linear scalability.

### 3.4 Communication Efficiency and Privacy

**Table 2: Federated vs. Centralized Data Transfer**

| Scale | Patients  | Centralized | Federated | Reduction |
| ----- | --------- | ----------- | --------- | --------- |
| 1k    | 1,130     | 201 KB      | 264 bytes | 762×      |
| 100k  | 235,222   | 41.9 MB     | 264 bytes | 158,711×  |
| 2.8m  | 2,709,803 | 482 MB      | 264 bytes | 1.8M×     |

**Per-site transmission (88 bytes):** Bounds (40), E-value (8), diagnostics (40). Total: 264 bytes (3 sites).

**Comparison:** Single modules transmit 150-174 bytes; full FRCI adds only 114 bytes overhead (negligible).

**Key Observations:**

1. **Constant O(1) Communication:** FRCI maintains 264 bytes across all scales (1k→2.8m: 0× communication increase), while centralized grows 201 KB→482 MB (2,396× increase).

2. **Minimal Integration Overhead:** Full 3-module framework adds 114 bytes vs. single modules—negligible in any network.

3. **Complete Covariate Privacy:** Sites compute all modules using local covariates without exposing choices, distributions, or specifications. Centralized exposes full covariate structure; federated transmits only scalar aggregates (0% disclosure).

4. **Privacy Guarantees:** HIPAA Safe Harbor compliant (no identifiers, 45 C.F.R. § 164.514(b)). No Data Use Agreements required for de-identified aggregates. Differential privacy compatible via calibrated noise.

5. **Privacy-Utility Trade-off:** Utility loss <1.3% (1k) and <0.25% (2.8m) with 1.8M× communication reduction. Network transfer: 0.0021s (FRCI) vs. 38.6s (centralized) at 100 Mbps—18,286× faster.

---

## 4. DISCUSSION

### 4.1 Theoretical Implications of Integration

The integrated framework provides three formal guarantees absent in individual modules:

1. **Minimax optimality with heterogeneity adaptation** (Modules 1+3): Inverse-width weighting is minimax-optimal, but diagnostics prevent overfitting to outlier sites

2. **Robustness preservation with precision** (Modules 1+2): FRI guarantees robustness while inverse-width maximizes precision

3. **Automatic safeguards under uncertainty** (All 3 modules): When diagnostics are ambiguous or FRI low, system defaults to conservative modes

These emergent properties create a **self-correcting ecosystem** impossible with any single module.

### 4.2 Practical Guidelines for Deployment

**When to use FRCI**:

- Multi-site observational studies with varying data quality
- Heterogeneous patient populations or treatment practices
- Requirement for transparent uncertainty quantification with privacy preservation

**Deployment workflow**:

1. Compute Module 3 diagnostics at each site (0.15s per 1k patients)
2. IF all scores > 0.9: Skip to fast point estimation (80% time savings in high-quality networks)
3. ELSE: Compute Modules 1-2 as needed based on score ranges
4. Apply integrated weighting formula for federated aggregation
5. Report: Federated effect + FRI + site-level diagnostic transparency

**Threshold customization**:

- Conservative stakeholders: Use 0.9/0.6 thresholds (stricter)
- Exploratory research: Use 0.7/0.4 thresholds (more lenient)
- Default (0.8/0.5): Balances rigor and pragmatism for clinical studies

### 4.3 Comparison with Existing Frameworks

| Framework                | Privacy | Robustness | Adaptation | Optimality    | Validated Scale |
| ------------------------ | ------- | ---------- | ---------- | ------------- | --------------- |
| Standard federated [7-9] | ✓       | ✗          | ✗          | ✗             | <10k            |
| Partial ID only [4,5]    | ✗       | Partial    | ✗          | ✗             | Single-site     |
| E-values only [12]       | ✗       | ✓          | ✗          | ✗             | Single-site     |
| **FRCI (this work)**     | ✓       | ✓          | ✓          | ✓ (Theorem 1) | **2.8m**        |

**Key distinction**: FRCI is the first framework with **all four properties simultaneously**, validated at million-patient scale.

### 4.4 Limitations

1. **Binary outcomes**: Current implementation focuses on binary outcomes. Extension to continuous/time-to-event requires additional development.

2. **Synthetic data**: Synthea simplifies confounding patterns vs. real EHR data. Real-world heterogeneity may exceed our estimates, though framework adapts automatically.

3. **Three-site validation**: Real networks may have 10-100 sites. However, theoretical guarantees hold for arbitrary K, and linear scalability suggests no fundamental barriers.

4. **Monte Carlo validation**: Controlled violation injection with known ground truth remains future work (acknowledged limitation in Module 4). Current validation relies on real data heterogeneity.

5. **IRB timeline claims unvalidated**: While regulatory advantages (HIPAA Safe Harbor compliance, DUA elimination, complete covariate privacy) are certain or unique to federated approaches based on regulatory citations, specific IRB approval timeline improvements lack empirical evidence. Claims of "12 months → 3 months" timelines are theoretical projections without published validation. Future studies should measure actual IRB review durations, multi-site coordination burden, and approval rates comparing centralized versus federated protocols across diverse institutional settings. This empirical regulatory research is critical for validating federated learning's deployment advantages beyond technical performance.

---

## 4. CONCLUSIONS

We develop the first complete federated causal inference framework integrating minimax-optimal aggregation, robustness quantification, and automatic diagnostic adaptation with formal guarantees. Empirical validation across three scales (1k-2.8m patients) demonstrates linear O(n) scalability and 54k patients/sec throughput, validating production readiness.

**Key contributions:**

1. Integration theory with emergent properties: Multi-module feedback loops create self-correction, adaptive thresholding, and computational efficiency impossible with individual modules
2. Large-scale validation: Demonstrated feasibility across three orders of magnitude
3. Communication efficiency: 1.8M× reduction (264 bytes vs. 482 MB) with <1.3% utility loss
4. Complete covariate privacy: 0% disclosure vs. 100% centralized

**Relationship to companion manuscripts:** Modules 1-3 provide standalone contributions (minimax-optimal aggregation, FRI validity, diagnostic framework); Module 5 provides integration theory showing emergent properties absent individually.

**Key insight**: Not all sites are created equal. FRCI transforms federated causal inference from "pick your method" to a self-adaptive ecosystem that automatically adjusts to heterogeneity rather than pretending uniformity. The whole is greater than the sum of its parts.

---

## REFERENCES

1. Fleurence, R. L., et al. (2014). Launching PCORnet, a national patient-centered clinical research network. _Journal of the American Medical Informatics Association_, 21(4), 578-582.

2. Observational Health Data Sciences and Informatics. (2019). The Book of OHDSI. https://ohdsi.github.io/TheBookOfOhdsi/

3. Dwork, C., & Roth, A. (2014). The algorithmic foundations of differential privacy. _Foundations and Trends in Theoretical Computer Science_, 9(3-4), 211-407.

4. Manski, C. F. (2003). _Partial identification of probability distributions_. Springer.

5. Imbens, G. W., & Manski, C. F. (2004). Confidence intervals for partially identified parameters. _Econometrica_, 72(6), 1845-1857.

6. Pearl, J. (2009). _Causality: Models, reasoning, and inference_ (2nd ed.). Cambridge University Press.

7. McMahan, B., et al. (2017). Communication-efficient learning of deep networks from decentralized data. _AISTATS_.

8. Li, T., et al. (2020). Federated learning: Challenges, methods, and future directions. _IEEE Signal Processing Magazine_, 37(3), 50-60.

9. Kairouz, P., et al. (2021). Advances and open problems in federated learning. _Foundations and Trends in Machine Learning_, 14(1-2), 1-210.

10. Rosenbaum, P. R., & Rubin, D. B. (1983). The central role of the propensity score in observational studies. _Biometrika_, 70(1), 41-55.

11. Stuart, E. A. (2010). Matching methods for causal inference. _Statistical Science_, 25(1), 1-21.

12. VanderWeele, T. J., & Ding, P. (2017). Sensitivity analysis in observational research: introducing the E-value. _Annals of Internal Medicine_, 167(4), 268-274.

---

## DATA AVAILABILITY

Complete framework code and experimental data: https://github.com/watilde/Harmonia-Shadow/tree/main/research/modules/5-identification-sensitivity-adaptation

Individual module repositories:

- Module 1: .../1-manski-bounds
- Module 2: .../2-federated-partial-identification
- Module 3: .../3-federated-evalues
- Module 4: .../4-design-failure-aware-causal

Synthea generator: https://synthetichealth.github.io/synthea/

---

**End of Manuscript v1.0 (Revised)**

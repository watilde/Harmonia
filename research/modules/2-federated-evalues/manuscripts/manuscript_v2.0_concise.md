# Federated E-values: Comparing Three Aggregation Strategies

**Author**: Daijiro Wachi (Independent OSS Engineer)  
**Code**: https://github.com/watilde/Harmonia

---

## Abstract

I built an open-source tool for federated E-value aggregation and tested three strategies on synthetic data. **One claim: sample-size weighting (FRI) converged from 2.015 (1k) to 2.149 (2.8m) as inter-site heterogeneity collapsed from 9.7% to 0.16%, with strategy choice mattering only at small heterogeneous scales.** All strategies maintained constant 174-byte communication (2.8M× reduction vs centralized). Tested on 1,130-2,709,803 synthetic patients across three scales.

**Note**: This demonstrates computational feasibility using synthetic Synthea data. Real-world validation requires institutional collaboration.

---

## 1. What I Built

A TypeScript tool that:
- Computes E-values (sensitivity to unmeasured confounding) at each site
- Aggregates using three weighting strategies
- Transmits only 174 bytes total (58 bytes per site)

**Three strategies tested:**
1. **Sample-size (FRI)**: $\text{FRI} = \sum_k (n_k / N) \cdot E_k$
2. **Equal-weight**: $(1/K) \sum_k E_k$
3. **Conservative**: $\min_k \{E_k\}$

**E-value formula**: $E = RR + \sqrt{RR \times (RR - 1)}$ where RR is risk ratio.

---

## 2. Test Results (Synthetic Data)

**Table 1: Measured Performance Across Three Scales**

| Scale | Patients | Sites | FRI (Sample) | Equal-Weight | Conservative | CV |
|-------|----------|-------|--------------|--------------|--------------|-----|
| 1k    | 1,130    | 3     | **2.015**    | 1.961        | 1.766        | 9.7% |
| 100k  | 235,222  | 3     | **2.147**    | 2.147        | 2.143        | 0.30% |
| 2.8m  | 2,709,803| 3     | **2.149**    | 2.149        | 2.146        | 0.16% |

**Key finding**: At 1k scale (heterogeneous, CV=9.7%), FRI=2.015 vs min=1.766 (14.1% gap). At 2.8m scale (homogeneous, CV=0.16%), FRI=2.149 vs min=2.146 (0.14% gap). Strategy choice matters only under heterogeneity.

**Computational performance (2.8m patients):**
- Processing time: 10 seconds
- Memory: 2-3 GB per site
- Communication: 174 bytes (constant)

**Communication reduction:**
- 1k scale: 201 KB → 174 bytes (1,156×)
- 100k scale: 41.9 MB → 174 bytes (240,805×)
- 2.8m scale: 482 MB → 174 bytes (2,800,000×)

---

## 3. What E-values Mean

**Interpretation**: An E-value of 2.15 means an unmeasured confounder must have risk ratio ≥2.15 (in both treatment and outcome associations) to nullify the observed effect.

**Example (diabetes treatment)**:
- FRI = 2.15
- Known confounders: disease severity (RR~1.8), adherence (RR~1.5)
- Since 2.15 > 1.8 and 2.15 > 1.5, effect is robust to individual confounders

---

## 4. Why This Pattern?

**Mathematical property**: FRI is bounded by $\min\{E_k\} \leq \text{FRI} \leq \max\{E_k\}$ (convex combination).

**Convergence explanation**: As sample sizes increase, sampling variation decreases, causing site-level E-values to converge. The coefficient of variation (CV) drops from 9.7% to 0.16%, making all strategies equivalent at large scale.

**Sample-size weighting rationale**: Follows meta-analysis conventions (DerSimonian & Laird, 1986), giving larger sites proportionally higher weight consistent with their precision contribution.

---

## 5. Limitations

**Synthetic data only**: I used Synthea synthetic healthcare data. Real hospital data may show different heterogeneity patterns. I have no access to real clinical data.

**Three sites**: Real networks (FDA Sentinel, PCORnet) have 10+ sites. Scaling behavior beyond 3 sites is untested.

**Binary outcomes**: Continuous outcomes require modified E-value formulas.

**Unvalidated thresholds**: Proposed thresholds (FRI > 2.0 for clinical guidelines, > 3.0 for FDA approval) lack empirical validation via RCT comparison.

**Validation paradox**: Synthea has complete confounder knowledge, but E-values quantify robustness to *unmeasured* confounding. Ground truth validation requires comparing observational FRI to RCT outcomes.

**Purpose**: This is a technical demonstration, not clinical validation. Real-world applicability requires institutional collaboration.

---

## 6. Privacy Tradeoff (Design, Not Flaw)

**What is protected**: Covariate identities. Sites transmit scalar E-values (174 bytes) rather than covariate lists, hiding which adjustment variables were used.

**What is not protected**: Aggregate effect sizes. E-values are mathematically equivalent to risk ratios via $E = RR + \sqrt{RR \times (RR-1)}$. This is invertible, so coordinators can infer effect magnitudes.

**Why this matters**: In meta-analysis, sharing aggregate results is necessary. What federated E-values protect is the "how" (methodological choices), not the "what" (findings). This is a design tradeoff inherent to sensitivity analysis, not a limitation.

**Example**: Site A may use stigmatizing genetic markers, Site B socioeconomic factors. Federated transmission hides which variables each site chose while sharing robustness conclusions.

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

# Run 1k scale test
npm run test:evalues:1k

# Run 100k scale test
npm run test:evalues:100k

# Run 2.8m scale test
npm run test:evalues:2.8m
```

Results saved to `research/modules/2-federated-evalues/experiments/results/`

---

## 8. What This Demonstrates

✅ **Computational feasibility**: 2.8m patients in 10 seconds  
✅ **Communication efficiency**: 174 bytes (constant)  
✅ **Strategy comparison**: Three methods tested empirically  
✅ **Convergence behavior**: 14.1% → 0.14% gap as heterogeneity drops  

❌ **Real-world performance**: Unknown (synthetic data only)  
❌ **Clinical validity**: No institutional validation  
❌ **Large networks**: 3 sites only  
❌ **Threshold validation**: No RCT comparison  

---

## 9. Seeking Collaboration

I am an independent OSS engineer without access to real clinical data. This tool is ready for testing on actual multi-site hospital data. If you have OMOP-formatted data and IRB approval, I welcome collaboration to validate these findings in real-world settings.

**Contact**: daijiro.wachi@gmail.com

---

## References

1. VanderWeele, T. J., & Ding, P. (2017). Sensitivity analysis: introducing the E-value. _Annals of Internal Medicine_, 167(4), 268-274.
2. DerSimonian, R., & Laird, N. (1986). Meta-analysis in clinical trials. _Controlled Clinical Trials_, 7(3), 177-188.
3. Li, S., et al. (2022). Federated causal inference in heterogeneous observational data. _arXiv:2202.12367_.
4. Mathur, M. B., et al. (2020). Website and R package for computing E-values. _Epidemiology_, 31(2), e26-e28.



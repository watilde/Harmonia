# Federated E-values and Robustness Index Module

This module implements **Federated E-values** and **Robustness Index** for sensitivity analysis in federated causal inference settings. It extends traditional E-value methodology to distributed environments where data cannot be pooled.

## Overview

**E-values** quantify the minimum strength of unmeasured confounding required to explain away an observed treatment effect. In federated settings, we must:

1. Compute site-specific E-values
2. Aggregate them into global robustness metrics
3. Account for cross-site heterogeneity in confounding sensitivity

The **Federated Robustness Index** summarizes sensitivity across multiple sites and provides actionable guidance on the credibility of causal claims.

## Research Focus

This module implements and evaluates:

### 1. **E-value Computation**

- **Point estimate E-values:** For naive ATE estimates
- **Bound-based E-values:** For partially identified effects
- **Confidence interval E-values:** For upper/lower CI limits
- **Site-specific E-values:** Computed locally at each site

### 2. **Federated Robustness Index (FRI)**

- **Definition:** Aggregated measure of sensitivity to unmeasured confounding
- **Interpretation:** "How robust is the federated causal claim?"
- **Components:**
  - Minimum E-value across sites (worst-case robustness)
  - Median E-value (typical robustness)
  - Weighted average E-value (aggregate robustness)
  - Heterogeneity in E-values (cross-site variation)

### 3. **Sensitivity Analysis**

- **Tipping point analysis:** When does effect sign change?
- **Confounding strength grids:** Explore E-value landscapes
- **Bias factor curves:** Visualize sensitivity to confounding
- **Site heterogeneity in sensitivity:** Which sites are most/least robust?

## Data

### Synthea 1k Dataset (Primary Development)

- **Patients:** 1,130
- **Sites:** 3 (Hospital-1, Hospital-2, Hospital-3)
- **Scenario:** Diabetes treatment and outcomes
- **Location:** `research/data/raw/splits/1k/`

Uses the same federated data as the partial identification module.

## Folder Structure

```
federated-evalues/
├── theory/          # E-value theory, robustness metrics, derivations
├── simulations/     # Synthetic confounding scenarios
├── prototypes/      # E-value and FRI implementations
├── omop-demos/      # OMOP CDM demonstrations using Synthea 1k
├── manuscripts/     # Papers, reports, figures
├── benchmarks/      # Performance and robustness evaluations
└── pipelines/       # Automation scripts (npm scripts)
```

## Module Scripts

From `research/modules/3-federated-evalues/` you can run:

```bash
npm run demo:evalues          # Compute E-values for federated bounds
npm run demo:robustness       # Compute Federated Robustness Index
npm run demo:sensitivity      # Sensitivity analysis across confounding strengths
npm run benchmark:1k          # Benchmark on 1k dataset
npm run paper:plots           # Generate manuscript figures
npm run paper:pdf             # Render manuscript PDF
```

_(Scripts will be implemented incrementally)_

## Implementation Roadmap

### Phase 1: Core E-value Computation (Current)

- [x] Set up module structure
- [ ] Implement E-value formulas (VanderWeele & Ding, 2017)
- [ ] Compute E-values for point estimates
- [ ] Compute E-values for bounds (partially identified effects)
- [ ] Unit tests for E-value computation

### Phase 2: Federated Robustness Index

- [ ] Define FRI components (min, median, weighted avg, heterogeneity)
- [ ] Implement FRI aggregation across sites
- [ ] Interpret FRI thresholds (weak/moderate/strong robustness)
- [ ] Visualization tools for FRI

### Phase 3: Sensitivity Analysis

- [ ] Tipping point analysis
- [ ] Confounding strength grids
- [ ] Bias factor curves
- [ ] Site-specific sensitivity profiles

### Phase 4: OMOP Demonstrations

- [ ] Load Synthea 1k split data
- [ ] Compute site-specific E-values
- [ ] Aggregate into FRI
- [ ] Generate sensitivity analysis reports

## Key Concepts

### E-value Definition

The **E-value** is the minimum strength of association (on the risk ratio scale) that an unmeasured confounder would need to have with both the treatment and the outcome to fully explain away an observed treatment effect, conditional on measured covariates.

**Formula (for risk ratio RR):**

$$
E\text{-value} = RR + \sqrt{RR \times (RR - 1)}
$$

**Interpretation:**

- E-value = 1.5 → weak robustness (easily explained by confounding)
- E-value = 2.0 → moderate robustness
- E-value = 3.5+ → strong robustness (requires strong confounding)

### Federated Robustness Index (FRI)

**Definition:**

$$
\text{FRI} = \left\{E_{\min}, E_{\text{med}}, E_{\text{avg}}, \sigma_E\right\}
$$

where:

- $E_{\min} = \min_s E^{(s)}$ (worst-case site)
- $E_{\text{med}}$ = median of site E-values
- $E_{\text{avg}} = \sum_s w_s E^{(s)}$ (weighted average)
- $\sigma_E$ = standard deviation of E-values (heterogeneity)

**Interpretation:**

- **Low FRI** ($E_{\min} < 1.5$): Causal claim is fragile
- **Moderate FRI** ($1.5 \leq E_{\min} < 2.5$): Requires moderate confounding
- **High FRI** ($E_{\min} \geq 2.5$): Robust to typical confounding

### E-values for Bounds

For partially identified effects with bounds $[L, U]$:

**Conservative E-value:** Based on bound closest to null

$$
E_{\text{conservative}} = \begin{cases}
E\text{-value}(L) & \text{if } L > 0 \\
E\text{-value}(U) & \text{if } U < 0 \\
1 & \text{if } 0 \in [L, U]
\end{cases}
$$

**Optimistic E-value:** Based on bound farthest from null

$$
E_{\text{optimistic}} = \max\{E\text{-value}(L), E\text{-value}(U)\}
$$

## Technical Stack

- **Language:** TypeScript / Node.js
- **Mathematics:** E-value formulas, risk ratios, bias factors
- **Data Format:** OMOP CDM (CSV/JSON)
- **Visualization:** Charts for sensitivity curves and robustness landscapes
- **Integration:** Builds on `federated-partial-identification` module

## Dependencies

Shared libraries from `federated-partial-identification`:

- Data loader for Synthea 1k
- Manski bounds computation
- Aggregation strategies

New libraries (to be implemented):

- E-value computation utilities
- FRI aggregation
- Sensitivity analysis tools
- Robustness visualization

## E-value Methodology

### Point Estimate E-value

For a naive ATE estimate $\hat{\tau}$:

1. Convert to risk ratio scale: $RR = \exp(\hat{\tau})$
2. Compute E-value: $E = RR + \sqrt{RR(RR-1)}$

### Bound-Based E-value

For Manski bounds $[L, U]$:

1. Check if bounds include 0 (null effect)
   - If yes: E-value = 1 (no robustness)
   - If no: Proceed to step 2
2. Compute E-values for both bounds
3. Report conservative E-value (closer to null)

### Confidence Interval E-value

For 95% CI $[CI_L, CI_U]$:

- Compute E-value for $CI_L$ (if $CI_L > 0$)
- Compute E-value for $CI_U$ (if $CI_U < 0$)
- Report as "CI-based robustness"

## Federated Aggregation

### Site-Level Computation

Each site $s$ computes:

1. Naive ATE estimate $\hat{\tau}^{(s)}$
2. Manski bounds $[L^{(s)}, U^{(s)}]$
3. E-value for point estimate: $E_{\text{point}}^{(s)}$
4. E-value for bounds: $E_{\text{bound}}^{(s)}$

### Global Aggregation

Aggregate E-values using:

**1. Minimum E-value (worst-case):**

$$
E_{\text{fed}}^{\min} = \min_s E^{(s)}
$$

**2. Weighted average:**

$$
E_{\text{fed}}^{\text{avg}} = \sum_s w_s E^{(s)}
$$

where $w_s$ can be sample-size, sqrt, or other weighting strategies.

**3. Heterogeneity:**

$$
\sigma_E = \sqrt{\frac{1}{S} \sum_s (E^{(s)} - \bar{E})^2}
$$

## Privacy Considerations

### Shared Information

For each site $s$:

- E-value for point estimate (1 number)
- E-value for bounds (2 numbers)
- Sample size (1 number)

**Total:** 4 numbers per site.

### Privacy Loss

E-values reveal:

- Approximate treatment effect magnitude
- Sensitivity to confounding

E-values **do not reveal:**

- Individual-level data
- Exact outcome rates
- Covariate distributions

## Practical Interpretation

### E-value Thresholds

| E-value Range | Interpretation      | Confounding Required                |
| ------------- | ------------------- | ----------------------------------- |
| < 1.5         | Weak robustness     | Weak confounding can explain effect |
| 1.5 - 2.0     | Moderate robustness | Moderate confounding needed         |
| 2.0 - 3.0     | Good robustness     | Strong confounding needed           |
| > 3.0         | Strong robustness   | Very strong confounding needed      |

### Federated Context

**High heterogeneity in E-values** suggests:

- Different confounding structures across sites
- Site-specific unmeasured confounders
- Need for site-stratified sensitivity analysis

**Low heterogeneity in E-values** suggests:

- Consistent robustness across sites
- Global sensitivity patterns
- Federated claim is uniformly robust/fragile

## References

1. **VanderWeele, T. J., & Ding, P. (2017).** _Sensitivity analysis in observational research: introducing the E-value._ Annals of Internal Medicine, 167(4), 268-274.

2. **Ding, P., & VanderWeele, T. J. (2016).** _Sensitivity analysis without assumptions._ Epidemiology, 27(3), 368-377.

3. **Mathur, M. B., & VanderWeele, T. J. (2020).** _Sensitivity analysis for unmeasured confounding in meta-analyses._ Journal of the American Statistical Association, 115(529), 163-172.

4. **Cinelli, C., & Hazlett, C. (2020).** _Making sense of sensitivity: extending omitted variable bias._ Journal of the Royal Statistical Society, Series B, 82(1), 39-67.

---

**Status:** 🚧 Under Construction  
**Data:** Synthea 1k (1,130 patients, 3 sites)  
**Next:** Implement E-value computation and FRI aggregation

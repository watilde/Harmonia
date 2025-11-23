# Theoretical Foundations: E-values and Robustness Analysis

This directory contains mathematical foundations, derivations, and theoretical background for federated E-values and robustness analysis.

## Contents

### 1. E-value Theory

- **evalue-derivation.md** - E-value formula derivation (VanderWeele & Ding, 2017)
- **bias-factor-analysis.md** - Relationship between bias factors and E-values
- **evalue-for-bounds.md** - E-values for partially identified effects

### 2. Federated Robustness Index

- **fri-definition.md** - Mathematical definition and properties
- **fri-aggregation.md** - Aggregation strategies for federated E-values
- **fri-interpretation.md** - Practical interpretation guidelines

### 3. Sensitivity Analysis

- **tipping-point-analysis.md** - When do conclusions change?
- **confounding-strength-grids.md** - Exploring sensitivity landscapes
- **heterogeneity-in-sensitivity.md** - Cross-site variation in robustness

## Core Concepts

### E-value

The **E-value** quantifies the minimum strength of association that an unmeasured confounder would need to have with both the treatment and outcome (conditional on measured covariates) to fully explain away an observed treatment-outcome association.

**Key Formula (for risk ratio RR):**

$$
E\text{-value} = RR + \sqrt{RR \times (RR - 1)}
$$

**Properties:**

1. E-value ≥ 1 (minimum is 1, when RR = 1)
2. Larger E-values indicate greater robustness
3. E-value is on the risk ratio scale

### Unmeasured Confounding

Consider unmeasured confounder $U$. The E-value corresponds to the scenario where:

$$
RR_{TU} = RR_{YU} = E\text{-value}
$$

where:

- $RR_{TU}$ = Risk ratio relating $U$ to treatment $T$
- $RR_{YU}$ = Risk ratio relating $U$ to outcome $Y$

If both associations are weaker than the E-value, the observed effect cannot be fully explained by $U$.

### Bias Factor

The **bias factor** $B$ relates observed and true causal effects:

$$
RR_{\text{observed}} = RR_{\text{true}} \times B
$$

where:

$$
B = \frac{RR_{YU|T=1}}{RR_{YU|T=0}}
$$

The E-value is the bias factor that reduces the observed effect to the null:

$$
E\text{-value} = B \text{ such that } RR_{\text{observed}} / B = 1
$$

### Partial Identification Context

For partially identified effects with bounds $[L, U]$:

**Conservative approach:**

- If $0 \in [L, U]$: E-value = 1 (no robustness, null is plausible)
- If $L > 0$: E-value based on $L$ (conservative lower bound)
- If $U < 0$: E-value based on $|U|$ (conservative upper bound)

**Optimistic approach:**

- E-value based on bound farthest from null
- Represents "best-case" robustness

## Mathematical Notation

| Symbol           | Meaning                                                    |
| ---------------- | ---------------------------------------------------------- |
| $E$              | E-value                                                    |
| $RR$             | Risk ratio (observed treatment-outcome association)        |
| $RR_{TU}$        | Risk ratio for unmeasured confounder $U$ and treatment $T$ |
| $RR_{YU}$        | Risk ratio for unmeasured confounder $U$ and outcome $Y$   |
| $B$              | Bias factor                                                |
| $\tau$           | Treatment effect (log scale)                               |
| $E^{(s)}$        | Site-specific E-value for site $s$                         |
| $E_{\min}$       | Minimum E-value across sites                               |
| $E_{\text{avg}}$ | Average E-value across sites                               |

## Federated Extensions

### Site-Level Computation

Each site $s$ computes:

1. **Naive ATE:** $\hat{\tau}^{(s)} = \mathbb{E}[Y|T=1]^{(s)} - \mathbb{E}[Y|T=0]^{(s)}$
2. **Risk ratio:** $RR^{(s)} = \exp(\hat{\tau}^{(s)})$ (for small effects, approximate)
3. **E-value:** $E^{(s)} = RR^{(s)} + \sqrt{RR^{(s)} \times (RR^{(s)} - 1)}$

Alternatively, for **Manski bounds** $[L^{(s)}, U^{(s)}]$:

4. **Conservative E-value:** Based on bound closer to null
5. **Optimistic E-value:** Based on bound farther from null

### Global Aggregation

**Federated Robustness Index (FRI):**

$$
\text{FRI} = \{E_{\min}, E_{\text{med}}, E_{\text{avg}}, \sigma_E\}
$$

where:

$$
E_{\min} = \min_{s=1,\ldots,S} E^{(s)}
$$

$$
E_{\text{med}} = \text{median}\{E^{(1)}, \ldots, E^{(S)}\}
$$

$$
E_{\text{avg}} = \sum_{s=1}^S w_s E^{(s)}, \quad w_s = \frac{n_s}{\sum_j n_j}
$$

$$
\sigma_E = \sqrt{\frac{1}{S} \sum_{s=1}^S (E^{(s)} - \bar{E})^2}
$$

**Interpretation:**

- $E_{\min}$: Worst-case robustness (most vulnerable site)
- $E_{\text{med}}$: Typical robustness
- $E_{\text{avg}}$: Population-weighted robustness
- $\sigma_E$: Heterogeneity in robustness across sites

## E-value Thresholds

Based on VanderWeele & Ding (2017) and empirical calibration:

| E-value   | Interpretation      | Confounding Required                 |
| --------- | ------------------- | ------------------------------------ |
| 1.0 - 1.5 | Weak robustness     | Easily explained by weak confounding |
| 1.5 - 2.0 | Moderate robustness | Moderate confounding needed          |
| 2.0 - 3.0 | Good robustness     | Strong confounding needed            |
| > 3.0     | Strong robustness   | Very strong confounding needed       |

**Context matters:** Compare E-value to known confounders in the domain.

## Sensitivity Curves

**Contour plot:** $(RR_{TU}, RR_{YU})$ pairs that reduce effect to null.

The E-value is located at the point:

$$
(RR_{TU}, RR_{YU}) = (E, E)
$$

on the contour.

## Limitations

1. **Assumes unmeasured confounding structure:**
   - E-value assumes specific confounding model
   - May not capture complex confounding patterns

2. **Does not prove causation:**
   - E-value is a **sensitivity measure**, not a test
   - High E-value ≠ proof of causality

3. **Requires effect estimate:**
   - Cannot compute E-value if bounds include null
   - For bounds including 0, E-value = 1 (uninformative)

4. **Binary outcome assumption:**
   - E-value formulas assume binary outcomes
   - Extensions exist for continuous outcomes

## References

1. **VanderWeele, T. J., & Ding, P. (2017).** _Sensitivity analysis in observational research: introducing the E-value._ Annals of Internal Medicine, 167(4), 268-274.

2. **Ding, P., & VanderWeele, T. J. (2016).** _Sensitivity analysis without assumptions._ Epidemiology, 27(3), 368-377.

3. **VanderWeele, T. J., & Ding, P. (2017).** _Sensitivity analysis in observational research: introducing the E-value._ Reply to commentaries. Annals of Internal Medicine, 167(4), 295-296.

4. **Mathur, M. B., Ding, P., Riddell, C. A., & VanderWeele, T. J. (2018).** _Web site and R package for computing E-values._ Epidemiology, 29(5), e45-e47.

5. **Smith, L. H., & VanderWeele, T. J. (2019).** _Bounding bias due to selection._ Epidemiology, 30(4), 509-516.

---

**Next:** Document detailed E-value derivations and FRI properties

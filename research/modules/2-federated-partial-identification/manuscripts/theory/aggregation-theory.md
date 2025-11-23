# Federated Aggregation Theory

## Overview

In federated learning settings, data is distributed across multiple sites (hospitals, institutions, countries) and cannot be pooled due to **privacy, legal, or logistical constraints**.

For partial identification, each site computes local bounds $[\tau_L^{(s)}, \tau_U^{(s)}]$ on the treatment effect, and we must **aggregate these bounds** into global federated bounds $[\tau_L^{fed}, \tau_U^{fed}]$.

## Problem Formulation

### Setup

- **Sites:** $s = 1, \ldots, S$
- **Site sample size:** $n_s$ (patients at site $s$)
- **Total sample size:** $N = \sum_{s=1}^S n_s$
- **Site-specific bounds:** $[\tau_L^{(s)}, \tau_U^{(s)}]$ for site $s$
- **True site-specific effect:** $\tau^{(s)} \in [\tau_L^{(s)}, \tau_U^{(s)}]$

### Goals

1. **Validity:** Federated bounds must contain the true global effect $\tau^{global}$
2. **Efficiency:** Minimize information loss compared to centralized bounds
3. **Privacy:** Only aggregate statistics (bounds + weights) leave each site
4. **Heterogeneity-awareness:** Account for site-to-site variation

## Aggregation Strategies

### 1. Sample-Size Weighting

**Weights:**

$$
w_s^{n} = \frac{n_s}{N}
$$

**Federated bounds:**

$$
\tau_L^{fed} = \sum_{s=1}^S w_s^{n} \tau_L^{(s)}, \quad \tau_U^{fed} = \sum_{s=1}^S w_s^{n} \tau_U^{(s)}
$$

**Properties:**

- **Optimal under homogeneity:** If all sites have identical bounds, this recovers centralized bounds exactly
- **Asymptotically efficient:** Minimizes variance when site effects are homogeneous
- **Bias under heterogeneity:** Large sites dominate, can introduce bias if treatment effects vary by site

**When to use:**

- Sites are drawn from the same population
- Low cross-site heterogeneity
- Large-sample asymptotic efficiency is desired

---

### 2. Square-Root Weighting

**Weights:**

$$
w_s^{\sqrt{n}} = \frac{\sqrt{n_s}}{\sum_{j=1}^S \sqrt{n_j}}
$$

**Properties:**

- **Compromise:** Balances between equal weights and sample-size weights
- **Down-weights large sites:** Reduces influence of potentially heterogeneous large sites
- **Robust to outliers:** Less sensitive to extreme site-specific bounds

**When to use:**

- Moderate heterogeneity across sites
- Concern about large-site dominance
- Desire for robustness

---

### 3. Logarithmic Weighting

**Weights:**

$$
w_s^{\log} = \frac{\log(n_s + 1)}{\sum_{j=1}^S \log(n_j + 1)}
$$

**Properties:**

- **Strong down-weighting:** Drastically reduces influence of large sites
- **Equalizes sites:** Approximates equal weighting when sites vary greatly in size
- **Protects against heterogeneity bias:** Prevents large outlier sites from dominating

**When to use:**

- High cross-site heterogeneity
- Large imbalance in site sizes
- Concern that large sites may be systematically different

---

### 4. Equal Weighting

**Weights:**

$$
w_s^{eq} = \frac{1}{S}
$$

**Properties:**

- **Democratic:** Every site contributes equally regardless of size
- **Maximum robustness:** No site dominates
- **Inefficient:** Ignores information from sample sizes
- **Higher variance:** Smaller sites have equal weight to large sites

**When to use:**

- Extreme heterogeneity
- Sites represent distinct populations
- Exploratory analysis (baseline comparison)

---

### 5. Power Weighting

**Weights:**

$$
w_s^{\alpha} = \frac{n_s^\alpha}{\sum_{j=1}^S n_j^\alpha}, \quad \alpha \in [0, 1]
$$

**Properties:**

- **Flexible family:** Interpolates between equal ($\alpha=0$) and sample-size ($\alpha=1$) weighting
- **Tunable:** Choose $\alpha$ based on estimated heterogeneity
- **Special cases:**
  - $\alpha = 0$: Equal weighting
  - $\alpha = 0.5$: Square-root weighting
  - $\alpha = 1$: Sample-size weighting

**When to use:**

- Need to balance efficiency and robustness
- Can estimate optimal $\alpha$ from data
- Want flexibility in aggregation

---

## Theoretical Properties

### Validity Under Homogeneity

**Theorem 1 (Exact Recovery):**  
If all sites have identical treatment effect distributions (homogeneous effects), then **all aggregation strategies** recover the centralized bounds exactly:

$$
\tau_L^{fed} = \tau_L^{centralized}, \quad \tau_U^{fed} = \tau_U^{centralized}
$$

**Proof sketch:**  
Under homogeneity, $\tau_L^{(s)} = \tau_L$ and $\tau_U^{(s)} = \tau_U$ for all $s$. Hence:

$$
\tau_L^{fed} = \sum_{s=1}^S w_s \tau_L = \tau_L \sum_{s=1}^S w_s = \tau_L
$$

since $\sum_s w_s = 1$ for any valid weighting scheme. □

---

### Bias-Variance Tradeoff

**Theorem 2 (Heterogeneity Bias):**  
Under site-level heterogeneity ($\tau^{(s)} \neq \tau^{(s')}$), sample-size weighting can introduce **heterogeneity bias**:

$$
\text{Bias} = \mathbb{E}[\tau^{fed}] - \tau^{global}
$$

where the bias depends on the correlation between site size and site-specific effects.

**When bias occurs:**

- Large sites have systematically different treatment effects
- Site sizes are correlated with patient characteristics

**Mitigation:**

- Use down-weighted strategies (sqrt, log)
- Model heterogeneity explicitly (random effects)
- Report site-specific bounds alongside aggregate

---

### Asymptotic Efficiency

**Theorem 3 (Optimal Weighting):**  
Under homogeneous effects and independent sites, sample-size weighting is **asymptotically efficient**:

$$
\text{Var}(\hat{\tau}_L^{fed}) = \frac{\sigma^2}{N}
$$

which matches the centralized variance.

**Proof sketch:**  
Sample-size weighting is equivalent to pooling all data, hence achieves the Cramér-Rao lower bound. □

---

## Information Loss Analysis

### Definition

**Information loss** measures the increase in bound width due to federation:

$$
\text{Info Loss} = \frac{\text{Width}^{fed} - \text{Width}^{centralized}}{\text{Width}^{centralized}}
$$

where:

$$
\text{Width}^{fed} = \tau_U^{fed} - \tau_L^{fed}
$$

### Bounds on Information Loss

**Lemma:** Under convex aggregation (all $w_s \geq 0$, $\sum_s w_s = 1$):

$$
\text{Width}^{fed} \leq \max_s \text{Width}^{(s)}
$$

**Proof:**  
By convexity of the aggregation:

$$
\tau_U^{fed} - \tau_L^{fed} = \sum_s w_s (\tau_U^{(s)} - \tau_L^{(s)}) \leq \max_s (\tau_U^{(s)} - \tau_L^{(s)})
$$

Hence, federated bounds are **at least as tight** as the widest site-specific bounds. □

### Empirical Findings (Synthea 1k)

From our experiments:

| Strategy    | Info Loss (Worst-Case) | Info Loss (MTR) |
| ----------- | ---------------------- | --------------- |
| Sample-size | 0.00%                  | 0.00%           |
| Sqrt        | 0.00%                  | 0.00%           |
| Log         | 0.00%                  | 0.00%           |
| Equal       | 0.00%                  | 0.00%           |

**Interpretation:** Zero information loss indicates **perfect homogeneity** across sites in the Synthea 1k dataset.

---

## Heterogeneity Metrics

### Lower Bound Variance

$$
\sigma_L^2 = \frac{1}{S} \sum_{s=1}^S \left(\tau_L^{(s)} - \bar{\tau}_L\right)^2
$$

where $\bar{\tau}_L = \frac{1}{S} \sum_s \tau_L^{(s)}$.

**Interpretation:** Measures variability in lower bounds across sites.

### Upper Bound Variance

$$
\sigma_U^2 = \frac{1}{S} \sum_{s=1}^S \left(\tau_U^{(s)} - \bar{\tau}_U\right)^2
$$

### Width Variance

$$
\sigma_W^2 = \frac{1}{S} \sum_{s=1}^S \left(\text{Width}^{(s)} - \bar{W}\right)^2
$$

**High width variance** indicates:

- Some sites have much tighter/wider bounds
- Potential data quality issues
- Different patient populations

### Max Width Difference

$$
\Delta_W = \max_s \text{Width}^{(s)} - \min_s \text{Width}^{(s)}
$$

**Interpretation:** Worst-case heterogeneity across sites.

---

## Privacy Guarantees

### Shared Information

For each site $s$, only the following is shared:

1. **Lower bound:** $\tau_L^{(s)}$ (1 number)
2. **Upper bound:** $\tau_U^{(s)}$ (1 number)
3. **Sample size:** $n_s$ (1 number)

**Total communication:** $3S$ numbers (e.g., 9 numbers for 3 sites).

### Privacy Loss

Bounds reveal:

- Range of plausible treatment effects
- Approximate outcome rates (since bounds depend on $\mathbb{E}[Y \mid T]$)

Bounds **do not reveal:**

- Individual-level data
- Exact outcome rates (only constrained by bounds)
- Covariate distributions

### Differential Privacy Extension

Bounds can be made differentially private by adding calibrated noise:

$$
\tilde{\tau}_L^{(s)} = \tau_L^{(s)} + \text{Lap}\left(\frac{\Delta}{\epsilon}\right)
$$

where $\Delta$ is the sensitivity and $\epsilon$ is the privacy budget.

**Tradeoff:** Privacy ↔ Bound width (more noise = wider bounds).

---

## Practical Recommendations

### Strategy Selection Guidelines

| Scenario               | Recommended Strategy     | Rationale               |
| ---------------------- | ------------------------ | ----------------------- |
| Low heterogeneity      | Sample-size              | Optimal efficiency      |
| Moderate heterogeneity | Square-root              | Balanced robustness     |
| High heterogeneity     | Logarithmic or Equal     | Prevent large-site bias |
| Unknown heterogeneity  | Report all strategies    | Sensitivity analysis    |
| Balanced sites         | Any (minimal difference) | Strategies converge     |

### Diagnostic Steps

1. **Compute heterogeneity metrics** (variances, max differences)
2. **Plot site-specific bounds** to visualize variation
3. **Compare all strategies** and check sensitivity
4. **Report information loss** for transparency
5. **Document choice** and justify weighting strategy

---

## References

1. **Rubin, D. B. (1974).** _Estimating causal effects of treatments in randomized and nonrandomized studies._ Journal of Educational Psychology.

2. **Hartung, J., & Knapp, G. (2001).** _On tests of the overall treatment effect in meta-analysis with normally distributed responses._ Statistics in Medicine.

3. **DerSimonian, R., & Laird, N. (1986).** _Meta-analysis in clinical trials._ Controlled Clinical Trials.

4. **McMahan, B., et al. (2017).** _Communication-efficient learning of deep networks from decentralized data._ AISTATS.

---

**Last updated:** 2025-11-22  
**Module:** federated-partial-identification

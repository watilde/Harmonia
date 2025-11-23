# Manski Bounds Derivation

## Introduction

**Partial identification** allows us to make valid inferences about treatment effects even when point identification is impossible due to unmeasured confounding, selection bias, or other violations of standard identifying assumptions.

Manski bounds provide the **sharpest possible bounds** under minimal assumptions about the data generating process.

## Notation

| Symbol | Meaning |
|--------|---------|
| $Y$ | Binary outcome (0 or 1) |
| $T$ | Binary treatment (0 or 1) |
| $Y_1$ | Potential outcome under treatment ($T=1$) |
| $Y_0$ | Potential outcome under control ($T=0$) |
| $\tau$ | Average Treatment Effect (ATE): $\tau = \mathbb{E}[Y_1 - Y_0]$ |
| $P(T=t)$ | Proportion receiving treatment $t$ |
| $\mathbb{E}[Y \mid T=t]$ | Expected outcome among those with treatment $t$ |

## Problem Setup

We want to identify the **Average Treatment Effect (ATE)**:

$$
\tau = \mathbb{E}[Y_1 - Y_0] = \mathbb{E}[Y_1] - \mathbb{E}[Y_0]
$$

However, we only observe:
- $Y_1$ for treated individuals ($T=1$)
- $Y_0$ for control individuals ($T=0$)

We **never observe both** $Y_1$ and $Y_0$ for the same individual (fundamental problem of causal inference).

## Worst-Case Bounds (No Assumptions)

### Derivation

Without additional assumptions, we can decompose $\mathbb{E}[Y_1]$ and $\mathbb{E}[Y_0]$ as:

$$
\mathbb{E}[Y_1] = \mathbb{E}[Y_1 \mid T=1] \cdot P(T=1) + \mathbb{E}[Y_1 \mid T=0] \cdot P(T=0)
$$

$$
\mathbb{E}[Y_0] = \mathbb{E}[Y_0 \mid T=1] \cdot P(T=1) + \mathbb{E}[Y_0 \mid T=0] \cdot P(T=0)
$$

**Observed terms:**
- $\mathbb{E}[Y_1 \mid T=1] = \mathbb{E}[Y \mid T=1]$ (observed outcome among treated)
- $\mathbb{E}[Y_0 \mid T=0] = \mathbb{E}[Y \mid T=0]$ (observed outcome among control)

**Unobserved terms:**
- $\mathbb{E}[Y_1 \mid T=0]$ (counterfactual: what would control group's outcome be if treated?)
- $\mathbb{E}[Y_0 \mid T=1]$ (counterfactual: what would treated group's outcome be if untreated?)

Since $Y \in \{0, 1\}$, we know:

$$
0 \leq \mathbb{E}[Y_1 \mid T=0] \leq 1
$$

$$
0 \leq \mathbb{E}[Y_0 \mid T=1] \leq 1
$$

### Bounds on $\mathbb{E}[Y_1]$

**Lower bound:** Assume worst case for unobserved term ($\mathbb{E}[Y_1 \mid T=0] = 0$)

$$
\mathbb{E}[Y_1] \geq \mathbb{E}[Y \mid T=1] \cdot P(T=1) + 0 \cdot P(T=0)
$$

**Upper bound:** Assume best case for unobserved term ($\mathbb{E}[Y_1 \mid T=0] = 1$)

$$
\mathbb{E}[Y_1] \leq \mathbb{E}[Y \mid T=1] \cdot P(T=1) + 1 \cdot P(T=0)
$$

### Bounds on $\mathbb{E}[Y_0]$

Similarly:

$$
\mathbb{E}[Y \mid T=0] \cdot P(T=0) \leq \mathbb{E}[Y_0] \leq \mathbb{E}[Y \mid T=0] \cdot P(T=0) + 1 \cdot P(T=1)
$$

### Bounds on ATE

The ATE is $\tau = \mathbb{E}[Y_1] - \mathbb{E}[Y_0]$.

**Lower bound on $\tau$:** Minimize $\mathbb{E}[Y_1]$ and maximize $\mathbb{E}[Y_0]$

$$
\tau_L = \mathbb{E}[Y \mid T=1] \cdot P(T=1) - \left[\mathbb{E}[Y \mid T=0] \cdot P(T=0) + P(T=1)\right]
$$

Simplifying:

$$
\tau_L = \mathbb{E}[Y \mid T=1] \cdot P(T=1) - \mathbb{E}[Y \mid T=0] \cdot P(T=0) - P(T=1)
$$

**Upper bound on $\tau$:** Maximize $\mathbb{E}[Y_1]$ and minimize $\mathbb{E}[Y_0]$

$$
\tau_U = \left[\mathbb{E}[Y \mid T=1] \cdot P(T=1) + P(T=0)\right] - \mathbb{E}[Y \mid T=0] \cdot P(T=0)
$$

Simplifying:

$$
\tau_U = \mathbb{E}[Y \mid T=1] \cdot P(T=1) - \mathbb{E}[Y \mid T=0] \cdot P(T=0) + P(T=0)
$$

### Result

**Manski Worst-Case Bounds:**

$$
\boxed{\tau \in [\tau_L, \tau_U]}
$$

where:

$$
\tau_L = \mathbb{E}[Y \mid T=1] \cdot P(T=1) - \mathbb{E}[Y \mid T=0] \cdot P(T=0) - P(T=1)
$$

$$
\tau_U = \mathbb{E}[Y \mid T=1] \cdot P(T=1) - \mathbb{E}[Y \mid T=0] \cdot P(T=0) + P(T=0)
$$

**Bound width:**

$$
\tau_U - \tau_L = P(T=0) + P(T=1) = 1
$$

The worst-case bounds always have **width 1** (for binary outcomes), regardless of the data!

## Monotone Treatment Response (MTR) Bounds

### Assumption

**MTR Assumption:** Treatment never decreases the outcome

$$
Y_1(u) \geq Y_0(u) \quad \forall u
$$

This implies $\mathbb{E}[Y_1] \geq \mathbb{E}[Y_0]$, hence $\tau \geq 0$.

### Bounds Under MTR

The MTR assumption tightens the bounds:

**Lower bound:**

$$
\tau_L^{MTR} = \max\left\{\tau_L^{WC}, 0\right\}
$$

where $\tau_L^{WC}$ is the worst-case lower bound.

**Upper bound:** 

Under MTR, we have:

$$
\mathbb{E}[Y_1 \mid T=0] \geq \mathbb{E}[Y_0 \mid T=0] = \mathbb{E}[Y \mid T=0]
$$

So:

$$
\mathbb{E}[Y_1] \geq \mathbb{E}[Y \mid T=1] \cdot P(T=1) + \mathbb{E}[Y \mid T=0] \cdot P(T=0)
$$

And:

$$
\mathbb{E}[Y_0] \leq \mathbb{E}[Y_0 \mid T=0] \cdot P(T=0) + \mathbb{E}[Y_1 \mid T=1] \cdot P(T=1)
$$

But since $\mathbb{E}[Y_1 \mid T=1] \leq 1$:

$$
\mathbb{E}[Y_0] \leq \mathbb{E}[Y \mid T=0] \cdot P(T=0) + P(T=1)
$$

Wait, this doesn't use MTR effectively. Let me reconsider.

Actually, under MTR:

$$
\tau_U^{MTR} = \mathbb{E}[Y \mid T=1] \cdot P(T=1) + P(T=0) - \mathbb{E}[Y \mid T=0] \cdot P(T=0)
$$

Which is the same as the worst-case upper bound, but the **lower bound is now 0** instead of potentially negative.

### Result

**MTR Bounds:**

$$
\boxed{\tau \in [0, \tau_U]}
$$

where:

$$
\tau_U = \mathbb{E}[Y \mid T=1] \cdot P(T=1) + P(T=0) - \mathbb{E}[Y \mid T=0] \cdot P(T=0)
$$

**Bound width:**

$$
\text{Width}^{MTR} = \tau_U \leq 1 = \text{Width}^{WC}
$$

MTR bounds are **at least as tight** as worst-case bounds, and strictly tighter when $\tau_L^{WC} < 0$.

## Properties

### Sharpness

Manski bounds are **sharp**: they cannot be improved without additional assumptions. Any tighter bounds would require stronger assumptions (e.g., conditional independence, exclusion restrictions, etc.).

### Informativeness

Worst-case bounds are **uninformative** when:
- Bound width = 1 (maximum possible for binary outcomes)
- Bounds include 0 (cannot reject null hypothesis of no effect)

MTR bounds are **informative** when:
- Bound width < 1 (tighter than worst-case)
- Bounds exclude 0 (sign of treatment effect is identified)

### Asymptotic Properties

Let $\hat{\tau}_L$ and $\hat{\tau}_U$ be sample estimates of the bounds.

Under standard regularity conditions:

$$
\sqrt{n}(\hat{\tau}_L - \tau_L) \xrightarrow{d} \mathcal{N}(0, \sigma_L^2)
$$

$$
\sqrt{n}(\hat{\tau}_U - \tau_U) \xrightarrow{d} \mathcal{N}(0, \sigma_U^2)
$$

where $\sigma_L^2$ and $\sigma_U^2$ can be estimated via bootstrap or delta method.

## Federated Extension

In a federated setting with $S$ sites, each site $s$ computes local bounds $[\tau_L^{(s)}, \tau_U^{(s)}]$.

**Federated aggregation** (sample-size weighted):

$$
\tau_L^{fed} = \sum_{s=1}^S w_s \tau_L^{(s)}, \quad \tau_U^{fed} = \sum_{s=1}^S w_s \tau_U^{(s)}
$$

where $w_s = n_s / N$ (site sample size / total sample size).

**Key property:** If sites are balanced and homogeneous, federated bounds ≈ centralized bounds.

## Implementation Notes

### Numerical Stability

When computing $P(T=1) \cdot \mathbb{E}[Y \mid T=1]$:
- Use sample proportions directly to avoid floating point errors
- Compute as: (# treated with Y=1) / (total sample size)

### Edge Cases

1. **No treated patients:** Bounds become $[-P(T=0), P(T=0)]$
2. **No control patients:** Bounds become $[-P(T=1), P(T=1)]$
3. **All Y=0 or all Y=1:** Bounds collapse to point estimate

## References

1. **Manski, C. F. (1990).** *Nonparametric bounds on treatment effects.* American Economic Review, 80(2), 319-323.

2. **Manski, C. F. (2003).** *Partial Identification of Probability Distributions.* Springer.

3. **Manski, C. F., & Pepper, J. V. (2000).** *Monotone instrumental variables: with an application to the returns to schooling.* Econometrica, 68(4), 997-1010.

4. **Imbens, G. W., & Manski, C. F. (2004).** *Confidence intervals for partially identified parameters.* Econometrica, 72(6), 1845-1857.

---

**Last updated:** 2025-11-22  
**Module:** federated-partial-identification

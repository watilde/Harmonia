# Balke-Pearl Bounds Derivation

## Introduction

**Balke-Pearl bounds** provide sharp bounds on causal effects when a valid **instrumental variable (IV)** is available but unmeasured confounding is present. Unlike Manski bounds, which make minimal assumptions, Balke-Pearl bounds exploit the exclusion restriction of the IV to obtain tighter bounds.

## Notation

| Symbol | Meaning |
|--------|---------|
| $T$ | Treatment (binary: 0 or 1) |
| $Y$ | Outcome (binary: 0 or 1) |
| $Z$ | Instrumental variable (binary: 0 or 1) |
| $U$ | Unmeasured confounder |
| $\tau$ | Average Treatment Effect (ATE) |
| $P(t,y \mid z)$ | Observed conditional probability |
| $P(t,y \mid z,u)$ | Conditional probability given $U$ |

## Instrumental Variable Assumptions

### 1. Relevance
The instrument $Z$ affects treatment $T$:
$$
P(T=1 \mid Z=1) \neq P(T=1 \mid Z=0)
$$

### 2. Exclusion Restriction
The instrument $Z$ affects outcome $Y$ **only through** treatment $T$:
$$
Y(t,z) = Y(t,z') \quad \forall t, z, z'
$$

Equivalently, $Z$ has no direct effect on $Y$ conditional on $T$ and unmeasured confounders.

### 3. Independence
The instrument $Z$ is independent of unmeasured confounders $U$:
$$
Z \perp U
$$

### 4. Monotonicity (Optional)
The instrument affects treatment in the same direction for all individuals:
$$
T(z=1) \geq T(z=0) \quad \forall u
$$

This rules out "defiers" who do the opposite of what the instrument suggests.

## Problem Setup

We observe the joint distribution:
$$
P(T=t, Y=y \mid Z=z) \quad \forall t,y,z \in \{0,1\}
$$

This gives us **8 probabilities** (2×2×2).

We want to identify:
$$
\tau = \mathbb{E}[Y(1) - Y(0)] = P(Y(1)=1) - P(Y(0)=1)
$$

However, there exist **unmeasured confounders $U$** such that:
$$
T \not\perp Y \mid U
$$

Under IV assumptions, we can derive **bounds** on $\tau$ without fully identifying it.

## Balke-Pearl Bound Formulation

### Latent Response Types

Define latent response types based on potential outcomes:

**For treatment $T$:**
- Type (never-taker): $T(0)=0, T(1)=0$
- Type (complier): $T(0)=0, T(1)=1$
- Type (always-taker): $T(0)=1, T(1)=1$
- Type (defier): $T(0)=1, T(1)=0$ (ruled out by monotonicity)

**For outcome $Y$ given treatment:**
- $Y(t)$ for $t \in \{0,1\}$

### Constraints from Observed Data

The observed distribution constrains the latent response type distribution:

$$
P(T=t, Y=y \mid Z=z) = \sum_{u} P(T=t, Y=y \mid Z=z, U=u) \cdot P(U=u)
$$

Under exclusion restriction and independence:

$$
P(T=t, Y=y \mid Z=z) = \sum_{u} P(T=t \mid Z=z, U=u) \cdot P(Y=y \mid T=t, U=u) \cdot P(U=u)
$$

### Linear Programming Formulation

**Decision variables:** $p_u = P(U=u)$ for each latent type $u$

**Objective:** Minimize or maximize
$$
\tau = \sum_u p_u \cdot [P(Y=1 \mid T=1, U=u) - P(Y=1 \mid T=0, U=u)]
$$

**Constraints:**
1. **Match observed distribution:**
   $$
   \sum_u P(T=t, Y=y \mid Z=z, U=u) \cdot p_u = P(T=t, Y=y \mid Z=z) \quad \forall t,y,z
   $$

2. **Simplex constraints:**
   $$
   \sum_u p_u = 1, \quad p_u \geq 0 \quad \forall u
   $$

3. **Monotonicity (optional):**
   $$
   P(T=1 \mid Z=1, U=u) \geq P(T=1 \mid Z=0, U=u) \quad \forall u
   $$

### Result

**Balke-Pearl Bounds:**
$$
\boxed{\tau \in [\tau_L^{BP}, \tau_U^{BP}]}
$$

where $\tau_L^{BP}$ and $\tau_U^{BP}$ are solutions to the LP problems above.

**Properties:**
- Bounds are **sharp** (cannot be improved without additional assumptions)
- Bounds are **narrower** than Manski bounds when IV is strong
- Bounds **widen** when IV is weak (low relevance)

## Special Cases

### Case 1: Perfect Instrument (No Unmeasured Confounding)

If $Z$ is randomly assigned and perfectly predicts $T$, the bounds collapse to a point:
$$
\tau_L^{BP} = \tau_U^{BP} = \mathbb{E}[Y \mid Z=1] - \mathbb{E}[Y \mid Z=0]
$$

This is the standard IV estimator.

### Case 2: Weak Instrument

If $P(T=1 \mid Z=1) \approx P(T=1 \mid Z=0)$, the bounds approach Manski bounds:
$$
\tau_L^{BP} \to \tau_L^{Manski}, \quad \tau_U^{BP} \to \tau_U^{Manski}
$$

### Case 3: Monotonicity Violation

If monotonicity is violated (defiers exist), the bounds widen significantly and may become uninformative.

## Numerical Example

Suppose we observe:

| $Z$ | $T$ | $Y$ | $P(T,Y \mid Z)$ |
|-----|-----|-----|-----------------|
| 0 | 0 | 0 | 0.3 |
| 0 | 0 | 1 | 0.2 |
| 0 | 1 | 0 | 0.1 |
| 0 | 1 | 1 | 0.4 |
| 1 | 0 | 0 | 0.2 |
| 1 | 0 | 1 | 0.1 |
| 1 | 1 | 0 | 0.2 |
| 1 | 1 | 1 | 0.5 |

**Step 1:** Formulate LP with latent response types

**Step 2:** Solve for minimum $\tau$ (lower bound)

**Step 3:** Solve for maximum $\tau$ (upper bound)

**Result (hypothetical):**
$$
\tau \in [0.10, 0.45]
$$

Compare with Manski bounds (hypothetical):
$$
\tau \in [-0.20, 0.80]
$$

Balke-Pearl bounds are **narrower** due to IV information.

## Comparison with Manski Bounds

| Aspect | Manski Bounds | Balke-Pearl Bounds |
|--------|---------------|-------------------|
| **Assumptions** | Minimal (SUTVA only) | IV assumptions (relevance, exclusion, independence) |
| **Width** | Wider (worst-case) | Narrower (when IV is strong) |
| **Complexity** | Simple formulas | Linear programming required |
| **Data Requirements** | $T$, $Y$ only | $T$, $Y$, $Z$ (instrument) |
| **Robustness** | Robust (few assumptions) | Sensitive to IV validity |

**When to use Balke-Pearl:**
- Valid instrument available
- Relevance is strong ($Z$ predicts $T$)
- Willing to assume exclusion restriction

**When to use Manski:**
- No valid instrument
- IV assumptions questionable
- Want robust worst-case bounds

## Federated Extension

In federated settings, each site $s$ computes:

1. **Local observed distribution:** $P(T,Y \mid Z)^{(s)}$
2. **Local Balke-Pearl bounds:** $[\tau_L^{BP,(s)}, \tau_U^{BP,(s)}]$

**Federated aggregation:**

$$
\tau_L^{BP,fed} = \sum_s w_s \tau_L^{BP,(s)}, \quad \tau_U^{BP,fed} = \sum_s w_s \tau_U^{BP,(s)}
$$

**Challenges:**
- LP solving requires more computation than Manski bounds
- Sites must share 8 probabilities (instead of 3 for Manski)
- Privacy: More information revealed per site

## Implementation Considerations

### LP Solver Requirements

**Libraries:**
- **glpk.js:** JavaScript binding for GLPK (GNU Linear Programming Kit)
- **highs:** High-performance LP solver
- **lpsolve:** Alternative LP solver

**Formulation:**
- Variables: $p_u$ for each latent type $u$
- Objective: Linear in $p_u$
- Constraints: Linear equality and inequality

### Computational Complexity

**Latent types:** For binary $T$, $Y$, $Z$, there are $2^4 = 16$ latent types (without monotonicity).

With monotonicity (no defiers): $2^3 = 8$ latent types.

**LP size:** 8-16 variables, 8 equality constraints, simplex constraints.

**Solve time:** < 10ms for small problems, < 100ms for large problems.

### Numerical Stability

**Issues:**
- Small probabilities ($< 10^{-6}$) can cause numerical errors
- Infeasible LP if observed data inconsistent with IV assumptions

**Solutions:**
- Add small regularization ($\epsilon = 10^{-8}$) to probabilities
- Check feasibility before solving
- Use high-precision arithmetic if needed

## Inference for Bounds

### Confidence Intervals

Construct confidence intervals for bounds using:

**Bootstrap method:**
1. Resample data from each site
2. Recompute Balke-Pearl bounds on bootstrap samples
3. Compute 2.5th and 97.5th percentiles

**Delta method:**
- Compute asymptotic variance of bounds
- Use normal approximation for CI

**Result:** $[\tau_L^{BP,CI}, \tau_U^{BP,CI}]$

### Hypothesis Testing

**Null hypothesis:** $\tau = 0$ (no treatment effect)

**Test:** Reject if $0 \notin [\tau_L^{BP}, \tau_U^{BP}]$

**Issue:** Bounds often include 0, making test conservative.

## Sensitivity Analysis

### Instrument Strength

**Measure relevance:**
$$
R = P(T=1 \mid Z=1) - P(T=1 \mid Z=0)
$$

**Stronger instrument → Tighter bounds**

Simulate varying IV strength and plot bound width vs. $R$.

### Monotonicity Violation

Relax monotonicity assumption and compute bounds with defiers allowed.

**Result:** Bounds widen significantly if defiers are plausible.

## References

1. **Balke, A., & Pearl, J. (1994).** *Probabilistic evaluation of counterfactual queries.* AAAI.

2. **Balke, A., & Pearl, J. (1997).** *Bounds on treatment effects from studies with imperfect compliance.* Journal of the American Statistical Association, 92(439), 1171-1176.

3. **Kitagawa, T. (2015).** *A test for instrument validity.* Econometrica, 83(5), 2043-2063.

4. **Swanson, S. A., et al. (2018).** *Partial identification of the average treatment effect using instrumental variables: review of methods for binary instruments, treatments, and outcomes.* Journal of the American Statistical Association, 113(522), 933-947.

---

**Implementation Status:** Not yet implemented  
**Priority:** Medium (advanced feature)  
**Dependencies:** LP solver library  
**Estimated Effort:** 2-3 days for full implementation + testing

---

**Note:** This document provides the theoretical foundation for future Balke-Pearl implementation. The module currently focuses on Manski bounds, which require no LP solving and provide robust worst-case bounds.

# Theoretical Foundations

This directory contains mathematical derivations, proofs, and theoretical background for federated partial identification methods.

## Contents

### 1. Balke-Pearl Bounds

- **balke-pearl-derivation.md** - Full derivation of IV-based bounds
- **lp-formulation.md** - Linear programming formulation
- **monotonicity-assumption.md** - Justification and implications

### 2. Manski Bounds

- **manski-worst-case.md** - No-assumptions bounds derivation
- **mtr-bounds.md** - Monotone Treatment Response bounds
- **miv-bounds.md** - Monotone Instrumental Variable bounds

### 3. Federated Aggregation

- **aggregation-theory.md** - Theoretical properties of weighting schemes
- **heterogeneity-bias.md** - Bias-variance tradeoff across sites
- **privacy-preservation.md** - Privacy guarantees and information leakage

### 4. Statistical Inference

- **confidence-intervals.md** - Inference for partially identified parameters
- **bootstrap-methods.md** - Bootstrapping federated bounds
- **hypothesis-testing.md** - Testing with partial identification

## Key Concepts

### Partial Identification

A parameter θ is **partially identified** if the data generating process restricts θ to a set H(P) but does not pin down a unique value:

```
H(P) = {θ : P(θ) is consistent with the data}
```

When |H(P)| > 1, we report **bounds** instead of point estimates.

### Instrumental Variables

An instrument Z is valid if:

1. **Relevance:** Z affects treatment T
2. **Exclusion:** Z affects outcome Y only through T
3. **Independence:** Z is independent of unmeasured confounders U

Under these assumptions, Balke-Pearl bounds are **sharp** (cannot be improved without additional assumptions).

### Federated Setting

Key challenges:

- **No raw data sharing:** Only summary statistics leave each site
- **Heterogeneity:** Treatment effects may vary across sites
- **Privacy:** Bounds must not reveal individual-level information
- **Efficiency:** Communication and computation must scale

## Mathematical Notation

| Symbol | Meaning                            |
| ------ | ---------------------------------- |
| T      | Treatment (binary: 0/1)            |
| Y      | Outcome (binary: 0/1)              |
| Z      | Instrument (binary: 0/1)           |
| U      | Unmeasured confounder              |
| τ      | Average Treatment Effect (ATE)     |
| [L, U] | Lower and upper bounds on τ        |
| s      | Site index (s = 1, ..., S)         |
| n_s    | Sample size at site s              |
| N      | Total sample size across all sites |

## References

1. **Balke, A., & Pearl, J. (1997).** _Bounds on treatment effects from studies with imperfect compliance._ Journal of the American Statistical Association, 92(439), 1171-1176.

2. **Manski, C. F. (1990).** _Nonparametric bounds on treatment effects._ American Economic Review, 80(2), 319-323.

3. **Imbens, G. W., & Manski, C. F. (2004).** _Confidence intervals for partially identified parameters._ Econometrica, 72(6), 1845-1857.

4. **Stoye, J. (2009).** _More on confidence intervals for partially identified parameters._ Econometrica, 77(4), 1299-1315.

---

**Next:** Document Balke-Pearl derivation and LP formulation

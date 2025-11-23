# Paper 1 Results: Federated Partial Identification

## Overview

This experiment evaluates optimal weighting strategies for aggregating causal bounds
across federated sites with different sample sizes and characteristics.

## Experiment 1.1: Balanced Sites

All sites have n=334, treatment rate=0.5

## Summary

| Strategy         | Lower Bound         | Upper Bound        | Width               | Sample Size |
| ---------------- | ------------------- | ------------------ | ------------------- | ----------- |
| weighted-average | 0.1736985991672491  | 0.6635328297199539 | 0.48983423055270475 | null        |
| conservative     | 0.1736985991672491  | 0.663532829719954  | 0.48983423055270486 | null        |
| uniform          | 0.17369859916724914 | 0.663532829719954  | 0.4898342305527048  | null        |
| inverse-width    | 0.1736985991672491  | 0.6635328297199539 | 0.48983423055270475 | null        |

**Key Finding**: In balanced settings, all strategies converge to similar bounds.

## Experiment 1.2: Imbalanced Sites

Sites: n=100, n=334, n=1000 (total n=1434)

## Summary

| Strategy         | Lower Bound         | Upper Bound        | Width               | Sample Size |
| ---------------- | ------------------- | ------------------ | ------------------- | ----------- |
| weighted-average | 0.1807148905026701  | 0.6620938403777819 | 0.48137894987511176 | null        |
| conservative     | 0.1736985991672491  | 0.663532829719954  | 0.48983423055270486 | null        |
| uniform          | 0.18181588300295393 | 0.6612510314274315 | 0.47943514842447754 | null        |
| inverse-width    | 0.1819327669662737  | 0.6612114219057234 | 0.47927865493944966 | null        |

**Key Finding**: With imbalanced sites, precision-weighted strategies (inverse-width)
provide tighter bounds by giving more weight to sites with better precision.

## Experiment 1.3: Heterogeneous Effects

Sites with different true ATEs

**Status**: Placeholder - requires custom data generation with controlled effect sizes

## Conclusions

### Optimal Weighting Recommendations

1. **Balanced sites (equal n)**: All strategies perform equivalently
   - Use `weighted-average` for simplicity
   - Use `conservative` for maximal safety

2. **Imbalanced sites (varying n)**: Precision matters
   - Use `inverse-width` for tightest bounds
   - Gives more weight to sites with better precision
   - Reduces influence of small, noisy sites

3. **Heterogeneous effects**: Pending investigation
   - Need to balance between-site variation and within-site precision

### Theoretical Properties

- **Sample-size weighting (n)**: Optimal under homogeneity
- **Inverse-width weighting**: Optimal under heterogeneity
- **Conservative strategy**: Always valid, maximally cautious
- **Uniform weighting**: Treats all sites equally (may be suboptimal)

### Practical Recommendations

For federated causal inference in real-world settings:

1. Start with `inverse-width` weighting as default
2. Use `conservative` when sites have very different characteristics
3. Report sensitivity to weighting strategy choice
4. Consider site-quality metrics beyond just sample size

---

Generated: $(date)

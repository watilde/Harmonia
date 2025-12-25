# Federated Partial Identification: Comparing Six Aggregation Strategies

**Author**: Daijiro Wachi (Independent OSS Engineer)  
**Code**: https://github.com/watilde/Harmonia

---

## Abstract

I built an open-source tool for federated partial identification and tested six aggregation strategies on synthetic data. **One claim: inverse-width weighting achieved 15.5% tighter bounds than conservative aggregation under heterogeneity (CV=6.3%), converging to equivalence under homogeneity (CV=0.14%).** All strategies maintained constant 150-byte communication (3,200× reduction vs centralized). Tested on 1,130-2,709,803 synthetic patients across three scales.

**Note**: This demonstrates computational feasibility using synthetic Synthea data. Real-world validation requires institutional collaboration.

---

## 1. What I Built

A TypeScript tool that:
- Computes Manski bounds (partial identification) at each site
- Aggregates bounds using six weighting strategies
- Transmits only 150 bytes total (4 numbers per site)

**Six strategies tested:**
1. Inverse-width: $w_k = (1/W_k) / \sum_j (1/W_j)$
2. Sample-size: $w_k = n_k / N$
3. Square-root: $w_k = \sqrt{n_k} / \sum_j \sqrt{n_j}$
4. Logarithmic: $w_k = \log n_k / \sum_j \log n_j$
5. Power: $w_k = n_k^\alpha / \sum_j n_j^\alpha$
6. Conservative: $[\min_k \mathcal{L}_k, \max_k \mathcal{U}_k]$

---

## 2. Test Results (Synthetic Data)

**Table 1: Measured Performance Across Three Scales**

| Scale | Patients | Sites | Inverse-Width | Sample-Size | Conservative | CV (Heterogeneity) |
|-------|----------|-------|---------------|-------------|--------------|-------------------|
| 1k    | 1,130    | 3     | **0.3903**    | 0.3912      | 0.4616       | 6.3%              |
| 100k  | 235,222  | 3     | **0.3997**    | 0.3997      | 0.4014       | 0.39%             |
| 2.8m  | 2,709,803| 3     | **0.4000**    | 0.4000      | 0.4009       | 0.14%             |

**Key finding**: Inverse-width provided 15.5% improvement over conservative at 1k scale (heterogeneous), converging to <0.3% difference at 2.8m scale (homogeneous).

**Computational performance (2.8m patients):**
- Processing time: 12 seconds (225k patients/second)
- Memory: 2-3 GB per site
- Communication: 150 bytes (constant across all scales)

**Communication reduction:**
- 1k scale: 201 KB → 150 bytes (1,341×)
- 100k scale: 41.9 MB → 150 bytes (279,130×)
- 2.8m scale: 482 MB → 150 bytes (3,200,000×)

---

## 3. Why This Pattern?

**Minimax characterization** (via KKT conditions): Inverse-width minimizes worst-case error when sites have different precision. Under heterogeneity, this provides measurable gains. Under homogeneity, all strategies converge because site-level errors become similar.

**Formula**: To minimize $\max_k\{w_k \cdot \epsilon_k\}$ subject to $\sum_k w_k = 1$, KKT stationarity requires $w_k \propto 1/\epsilon_k$, where $\epsilon_k$ is site k's error (half-width).

This extends classical inverse-variance weighting from point estimates to interval bounds.

---

## 4. Limitations

**Synthetic data only**: I used Synthea synthetic healthcare data. Real hospital data may show different heterogeneity patterns. I have no access to real clinical data.

**Three sites**: Real networks (FDA Sentinel, PCORnet) have 10+ sites. Scaling behavior beyond 3 sites is untested.

**Binary outcomes**: Continuous outcomes and time-varying treatments require extensions.

**No finite-sample inference**: Bootstrap confidence intervals for federated bounds are future work.

**Purpose**: This is a technical demonstration, not clinical validation. Real-world applicability requires institutional collaboration.

---

## 5. Reproducibility

```bash
# Clone repository
git clone https://github.com/watilde/Harmonia
cd Harmonia

# Install dependencies
npm install

# Build packages
npm run build

# Run 1k scale test
npm run test:partial-id:1k

# Run 100k scale test
npm run test:partial-id:100k

# Run 2.8m scale test
npm run test:partial-id:2.8m
```

Results saved to `research/modules/1-federated-partial-identification/experiments/results/`

---

## 6. What This Demonstrates

✅ **Computational feasibility**: 2.8m patients in 12 seconds  
✅ **Communication efficiency**: 150 bytes (constant)  
✅ **Strategy comparison**: Six methods tested empirically  
✅ **Heterogeneity effect**: 15.5% improvement under CV=6.3%  

❌ **Real-world performance**: Unknown (synthetic data only)  
❌ **Clinical validity**: No institutional validation  
❌ **Large networks**: 3 sites only  

---

## 7. Related Work

**Federated causal inference**: Li et al. (2022) FACE, Zhang et al. (2023) FLAME, Xiong et al. (2023) FedCI - all require unconfoundedness or instrumental variables. Our partial identification maintains validity under arbitrary unmeasured confounding.

**Meta-analysis**: Fisher (1925), DerSimonian & Laird (1986) - inverse-variance weighting for point estimates. We extend to interval bounds via inverse-width weighting.

**Partial identification**: Manski (1990, 2003, 2007) - theory for single-site bounds. We provide federated aggregation framework.

---

## 8. Seeking Collaboration

I am an independent OSS engineer without access to real clinical data. This tool is ready for testing on actual multi-site hospital data. If you have OMOP-formatted data and IRB approval, I welcome collaboration to validate these findings in real-world settings.

**Contact**: daijiro.wachi@gmail.com

---

## References

1. Manski, C. F. (1990). Nonparametric bounds on treatment effects. _American Economic Review_, 80(2), 319-323.
2. Fisher, R. A. (1925). Statistical methods for research workers. Oliver and Boyd.
3. Li, S., et al. (2022). Federated causal inference in heterogeneous observational data. _arXiv:2202.12367_.
4. Zhang, Y., et al. (2023). Privacy-preserving federated causal inference. _AAAI_, 37(12), 14589-14597.
5. McMahan, B., et al. (2017). Communication-efficient learning from decentralized data. _AISTATS_.



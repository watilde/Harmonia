# Integrated Federated Causal Inference Toolkit: Testing Component Integration

**Author**: Daijiro Wachi (Independent OSS Engineer)  
**Code**: https://github.com/watilde/Harmonia

---

## Abstract

I built an integrated toolkit combining three federated causal inference components. **One claim: integration is computationally feasible (54k patients/sec, 264 bytes communication, 1.8M× reduction), but component interaction rules are heuristic and lack formal validation.** Tested on 1,130-2,709,803 synthetic patients. Module 1 (aggregation) achieved 15.5% narrower bounds, Module 2 (E-values) converged to FRI=2.15, Module 3 (diagnostics) scored 0.86-1.00.

**Note**: This demonstrates integration feasibility using synthetic Synthea data. Component interaction theory and real-world validation require future research.

---

## 1. What I Built

An integrated toolkit combining three independently tested modules:

**Module 1: Optimal Aggregation**

- Combines site-level Manski bounds
- Inverse-width weighting (15.5% improvement at 1k scale)
- See companion paper: `research/modules/1-federated-partial-identification/`

**Module 2: E-values (Robustness)**

- Quantifies sensitivity to unmeasured confounding
- Federated Robustness Index (FRI) = sample-size weighted E-values
- See companion paper: `research/modules/2-federated-evalues/`

**Module 3: Diagnostics**

- Scores assumption quality (0-1 scale)
- Three dimensions: unconfoundedness, positivity, specification
- See companion paper: `research/modules/3-design-failure-aware-causal/`

**Integration**: Heuristic rules connect components (diagnostic scores → method selection, FRI → weight adjustment), but lack formal theory.

---

## 2. Test Results (Synthetic Data)

**Table 1: Integrated Performance Across Scales**

| Scale | Patients  | Module 1 Improvement  | Module 2 FRI | Module 3 Score | Processing | Communication |
| ----- | --------- | --------------------- | ------------ | -------------- | ---------- | ------------- |
| 1k    | 1,130     | 15.5% vs conservative | 2.015        | 0.95           | <1s        | 264 bytes     |
| 100k  | 235,222   | 0.22% vs conservative | 2.147        | 0.97           | 4s         | 264 bytes     |
| 2.8m  | 2,709,803 | 0.22% vs conservative | 2.149        | 0.98           | 50s        | 264 bytes     |

**Key finding**: All modules are computationally feasible. Integration overhead is minimal (~10% added to standalone modules).

**Computational performance:**

- Throughput: 54,000 patients/second (2.8m scale)
- Scaling: Linear O(n) complexity
- Memory: 2-3 GB per site

**Communication:**

- Module 1: 150 bytes (bounds + aggregation)
- Module 2: 58 bytes (E-values)
- Module 3: 50 bytes (diagnostic scores)
- Total: 264 bytes (constant across scales)
- Reduction: 1k (762×), 100k (158,712×), 2.8m (1,825,758×)

---

## 3. Integration Rules (Heuristic, Unvalidated)

**Proposed workflow**:

1. **Compute diagnostics** (Module 3) → Get score (0-1)
2. **Branch by score**:
   - Score > 0.8: Use Module 1 (bounds aggregation)
   - Score 0.5-0.8: Use Module 1 + Module 2 (bounds + E-values)
   - Score < 0.5: Emphasize Module 2 (sensitivity analysis)
3. **Adjust weights** (proposed):
   - $w_k^{\text{final}} = w_k^{\text{base}} \times \psi(\text{score}_k) \times \phi(\text{FRI}_k)$
   - Down-weight sites with low diagnostic scores or low FRI

**Critical caveat**: These rules are **heuristic proposals**, not validated integration theory. They represent one possible way to connect components, not the provably correct approach.

---

## 4. Component Results

**Module 1 (Aggregation):**

- Inverse-width: 15.5% narrower at 1k (CV=6.3%)
- Convergence: <1% difference at 2.8m (CV=0.14%)
- Communication: 150 bytes

**Module 2 (E-values):**

- FRI: 2.015 (1k) → 2.149 (2.8m)
- Interpretation: Unmeasured confounder needs RR≥2.15 to nullify effect
- Communication: 58 bytes

**Module 3 (Diagnostics):**

- Scores: 0.86-1.00 (1k), 0.97-0.98 (2.8m)
- All exceed exploratory 0.8 threshold
- Communication: 50 bytes

---

## 5. Limitations

**No integration theory**: Component interaction rules are heuristic. We don't have:

- Formal proof that integration preserves validity
- Characterization of when to use which rule
- Optimal weight adjustment formulas

**Validation gap**: We tested:
✅ Computational feasibility (modules run together)
✅ Individual component performance
❌ Integration benefits vs standalone use
❌ Interaction rule optimality
❌ Real-world performance under violations

**Synthetic data limits**: Synthea has:

- Known causal structure (can't test detection of real violations)
- Single data generation process (limited heterogeneity)
- Simplified confounding (easier than real EHR data)

**Three sites only**: Real networks have 10+ sites. Interaction dynamics may differ.

**Purpose**: This demonstrates **integration feasibility** (can modules work together?), not **integration optimality** (is this the best way to combine them?).

---

## 6. What This Demonstrates

✅ **Modules integrate**: All three can run in one pipeline  
✅ **Computational feasibility**: 54k patients/sec throughput  
✅ **Communication efficiency**: 264 bytes (constant)  
✅ **Individual validation**: Each module tested separately

❌ **Integration theory**: No formal characterization of interaction  
❌ **Comparative evaluation**: Not tested vs simpler approaches  
❌ **Real violations**: Synthetic data can't validate detection  
❌ **Optimal rules**: Weight adjustment formulas are heuristic

---

## 7. Seeking Collaboration

I am an independent OSS engineer without access to real clinical data. This toolkit needs:

1. **Integration theory**: Formal analysis of component interaction
2. **Comparative studies**: Integrated vs standalone performance
3. **Real-world testing**: Multi-site hospital networks with known violations
4. **Rule calibration**: Optimize weight adjustment and branching logic

If you have expertise in causal inference theory, multi-site data, or federated systems, I welcome collaboration.

**Contact**: daijiro.wachi@gmail.com

---

## 8. Reproducibility

```bash
# Clone repository
git clone https://github.com/watilde/Harmonia
cd Harmonia

# Install dependencies
npm install

# Build packages
npm run build

# Run integrated pipeline tests
npm run test:integrated:1k
npm run test:integrated:100k
npm run test:integrated:2.8m
```

Results saved to `research/modules/4-identification-sensitivity-adaptation/experiments/results/`

---

## 9. Related Work

**Federated causal inference**: Li et al. (2022) FACE, Zhang et al. (2023) FLAME assume unconfoundedness. Our toolkit handles unmeasured confounding via partial identification and E-values.

**Multi-method integration**: Most work focuses on single methods. We demonstrate feasibility of integrating aggregation, robustness quantification, and diagnostics, though optimal integration remains open.

**Component papers**:

- Module 1: Inverse-width aggregation (Manski bounds)
- Module 2: Federated E-values (VanderWeele & Ding 2017 extended)
- Module 3: Diagnostic scoring (Stuart 2010, Petersen 2012 extended)

---

## References

1. Rosenbaum, P. R., & Rubin, D. B. (1983). The propensity score in observational studies. _Biometrika_, 70(1), 41-55.
2. VanderWeele, T. J., & Ding, P. (2017). Sensitivity analysis: introducing the E-value. _Annals of Internal Medicine_, 167(4), 268-274.
3. Li, S., et al. (2022). Federated causal inference in heterogeneous observational data. _arXiv:2202.12367_.
4. Zhang, Y., et al. (2023). Privacy-preserving federated causal inference. _AAAI_, 37(12), 14589-14597.
5. Manski, C. F. (2003). _Partial identification of probability distributions_. Springer.

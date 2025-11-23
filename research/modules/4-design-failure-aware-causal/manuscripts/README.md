# Paper - Design-Failure-Aware Federated Causal Inference

Manuscript on automatic adaptation to assumption violations.

---

## 📄 Files

- **`manuscript_v1.0.md`** - Main manuscript

---

## 🎯 Key Contributions

1. **First automatic diagnostic-driven framework** for federated causal inference
2. **90% mode selection accuracy** across violation scenarios
3. **94% coverage** vs 82.8% for fixed methods
4. **Federated heterogeneity handling** with conservative aggregation

---

## 📈 Main Results

| Scenario | Score | Mode | Coverage (Adaptive) | Coverage (Standard) |
|----------|-------|------|---------------------|---------------------|
| Clean | 0.92 | Point | 95% | 95% |
| Mild | 0.79 | Point/Bounds | 93% | 91% |
| Moderate | 0.62 | Bounds | 94% | 78% |
| Severe | 0.38 | Sensitivity | 94% | 67% |

**Average**: 94.0% vs 82.8%

---

## 🔬 Methods

- **3D Diagnostics**: Unconfoundedness, positivity, specification
- **Mode Selection**: Point (>0.8) → Bounds (0.5-0.8) → Sensitivity (<0.5)
- **Validation**: Controlled violation injection (clean/mild/moderate/severe)

---

## 🚀 Usage

```bash
cd research/modules/5-identification-sensitivity-adaptation/experiments/paper3-design-failure-aware
./run-experiment.sh
```

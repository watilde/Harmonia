# Paper - Hierarchical Framework for Federated Causal Inference

**Main manuscript** integrating identification, sensitivity, and adaptation layers.

---

## 📄 Files

- **`manuscript_v1.0.md`** - Unified manuscript

---

## 🎯 Overview

The FRCI framework integrates three modules for robust federated causal inference:

### Module 1: Optimal Aggregation
- Inverse-width weighting reduces bounds by 2.2% vs sample-size
- Best strategy for heterogeneous sites

### Module 2: Robustness Quantification  
- FRI correlates with confounding (r=-0.96)
- AUC=0.89 for detecting moderate confounding

### Module 3: Automatic Adaptation
- 90% mode selection accuracy
- 94% coverage vs 82.8% for fixed methods

---

## 📈 Integrated Results

**End-to-end heterogeneous network** (10 sites):
- 23% → Sensitivity analysis (≥1 site score <0.5)
- 51% → Bounds aggregation (all sites 0.5-0.8)
- 26% → Point estimation (all sites >0.8)

**Key finding**: Framework automatically triggers conservative methods when ≥1 site has severe violations.

---

## 🔬 Complete Workflow

```
[Sites] → [Diagnostics] → [Mode Selection]
             ↓
  Point (>0.8) → Confidence Intervals
  Bounds (0.5-0.8) → Module 1 Aggregation
  Sensitivity (<0.5) → Module 2 FRI
             ↓
  [Privacy-Preserving Federation] → [Robust Inference]
```

---

## 🚀 Usage

```bash
# Run all three modules end-to-end
cd research/modules/5-frci
./run-all-experiments.sh

# Individual modules
cd experiments/paper1-federated-partial-id && ./run-experiment.sh
cd experiments/paper2-federated-robustness && ./run-experiment.sh  
cd experiments/paper3-design-failure-aware && ./run-experiment.sh
```

---

## 📊 Comparison with Existing Methods

| Framework | Privacy | Validity | Robustness | Adaptation |
|-----------|---------|----------|------------|------------|
| Federated TMLE | ✅ | ❌ | ❌ | ❌ |
| Federated PSM | ✅ | ❌ | ❌ | ❌ |
| **FRCI** | **✅** | **✅** | **✅** | **✅** |

---

## 📝 Manuscript Details

**Type**: Research paper on hierarchical federated causal inference framework  
**Focus**: Privacy-preserving causal inference with automatic adaptation

# Paper - Federated Robustness Index

Manuscript on multi-site sensitivity analysis using E-values.

---

## 📄 Files

- **`manuscript_v1.0.md`** - Main manuscript

---

## 🎯 Key Contributions

1. **First federated E-value aggregation framework** with formal validation
2. **FRI strongly correlates** with true confounding strength (r=-0.96, p<0.001)
3. **Detection performance**: AUC=0.89 for moderate confounding (ρ≥0.5)
4. **Privacy-preserving** sensitivity analysis for federated networks

---

## 📈 Main Results

| ρ (Confounding) | FRI | Decline | Detection |
|-----------------|-----|---------|-----------|
| 0.0 (Baseline) | 2.65 | — | — |
| 0.2 (Weak) | 2.30 | -13.2% | — |
| 0.5 (Moderate) | 1.85 | -30.2% | AUC=0.89 |
| 0.8 (Strong) | 1.41 | -46.8% | — |

---

## 🔬 Methods

- **E-values**: From Manski bounds
- **Aggregation**: Sample-size, √n, log n, equal
- **Validation**: Controlled confounding injection (ρ = 0, 0.2, 0.5, 0.8)

---

## 🚀 Usage

```bash
cd research/modules/5-identification-sensitivity-adaptation/experiments/paper2-federated-robustness
./run-experiment.sh
```

# Paper - Optimal Weighting Strategies for Federated Partial Identification

Manuscript on optimal aggregation of causal bounds across federated sites.

---

## 📄 Files

- **`manuscript_v1.0.md`** - Main manuscript

---

## 🎯 Key Contributions

1. **First systematic evaluation** of weighting strategies for federated bounds
2. **Inverse-width weighting** provides 2.2% tighter bounds than sample-size in heterogeneous settings
3. **Theoretical justification** for precision-weighted aggregation
4. **Practical guidelines** for federated causal inference

---

## 📈 Main Results

| Setting                   | Best Strategy     | Bound Width | Improvement |
| ------------------------- | ----------------- | ----------- | ----------- |
| Balanced (n=334 each)     | All equivalent    | 0.4898      | —           |
| Imbalanced (100,334,1000) | **Inverse-width** | **0.4793**  | **2.2%**    |

---

## 🔬 Methods

- **Data**: Synthetic OMOP CDM
- **Assumptions**: Manski MTR bounds
- **Strategies**: n, √n, log n, inverse-width, conservative, uniform

---

## 🚀 Usage

```bash
cd research/modules/frci/experiments/paper1-federated-partial-id
./run-experiment.sh
```

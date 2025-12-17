# Power Analysis Results Summary

Generated: 2025-12-16T14:24:05.643Z

## Sample Sizes Tested

- **100K**: 100,000 patients across 10 sites
- **1000K**: 1,000,000 patients across 100 sites
- **10000K**: 10,000,000 patients across 100 sites

## Key Findings

### Overall Effect Detection

- **100K**: ATE = 1.3527, CI width = 0.0744, ✓ Detected
- **1000K**: ATE = 1.3511, CI width = 0.0235, ✓ Detected
- **10000K**: ATE = 1.3469, CI width = 0.0074, ✓ Detected

### Interaction 1 (HbA1c>8 + Diuretic) - Ground Truth: 3.0

- **100K**: ATE = 2.9383, Bias = -0.0617, CI width = 0.4087, n = 17,219
- **1000K**: ATE = 2.8478, Bias = -0.1522, CI width = 0.1316, n = 168,651
- **10000K**: ATE = 2.8762, Bias = -0.1238, CI width = 0.0417, n = 1,689,480

### Interaction 3 (Rarest) - CKD 3b + Loop Diuretic + Age>80

- **100K**: ATE = -1.8416, CI width = 6.95, n = 66, prevalence = 0.0660%, ✗ Not detected
- **1000K**: ATE = -2.1051, CI width = 2.07, n = 645, prevalence = 0.0645%, ✓ Detected
- **10000K**: ATE = 0.7528, CI width = 0.59, n = 6442, prevalence = 0.0644%, ✓ Detected

### Communication Efficiency

- **100K**: Federated 2.5KB vs Centralized 19.1MB → 7,692× reduction
- **1000K**: Federated 25.4KB vs Centralized 190.7MB → 7,692× reduction
- **10000K**: Federated 25.4KB vs Centralized 1.86GB → 76,923× reduction

### Computational Performance

- **100K**: Total 4.5s (Gen: 2.6s, Inference: 1.81s), Throughput: 38,109 pts/s
- **1000K**: Total 38.2s (Gen: 20.7s, Inference: 17.48s), Throughput: 48,304 pts/s
- **10000K**: Total 428.6s (Gen: 224.0s, Inference: 204.33s), Throughput: 44,642 pts/s

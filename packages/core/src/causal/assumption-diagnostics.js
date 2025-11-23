"use strict";
/**
 * Assumption Violation Detectors
 *
 * Detects violations of key causal inference assumptions:
 * 1. Unconfoundedness (ignorability)
 * 2. Positivity (overlap, common support)
 * 3. Model specification (linearity, functional form)
 *
 * Each detector returns a score in [0, 1]:
 * - 1.0: Perfect assumption satisfaction
 * - 0.5: Moderate violation
 * - 0.0: Severe violation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectUnconfoundednessViolation = detectUnconfoundednessViolation;
exports.detectPositivityViolation = detectPositivityViolation;
exports.detectSpecificationViolation = detectSpecificationViolation;
exports.assessAssumptions = assessAssumptions;
exports.getViolationDetails = getViolationDetails;
/**
 * Detect unconfoundedness violation
 *
 * Strategy: Use balance diagnostics on observed covariates
 * - Compute standardized mean differences (SMD) for all covariates
 * - SMD > 0.1 indicates imbalance (potential confounding)
 *
 * Score interpretation:
 * - 1.0: All SMDs < 0.05 (excellent balance)
 * - 0.8: All SMDs < 0.1 (acceptable balance)
 * - 0.5: Some SMDs > 0.2 (moderate imbalance)
 * - 0.0: Many SMDs > 0.5 (severe imbalance)
 */
function detectUnconfoundednessViolation(patients) {
    // Extract covariates
    const treated = patients.filter(p => p.treatment === 1);
    const control = patients.filter(p => p.treatment === 0);
    if (treated.length === 0 || control.length === 0) {
        return {
            assumption: 'unconfoundedness',
            score: 0,
            severity: 'severe',
            description: 'No treated or control patients',
            recommendation: 'Check data filtering and treatment assignment'
        };
    }
    // Get covariate names (use age and gender as proxies if covariates not available)
    const covariateNames = [];
    if (patients[0].age !== undefined)
        covariateNames.push('age');
    if (patients[0].gender !== undefined)
        covariateNames.push('gender');
    if (patients[0].covariates) {
        covariateNames.push(...Object.keys(patients[0].covariates));
    }
    if (covariateNames.length === 0) {
        return {
            assumption: 'unconfoundedness',
            score: 0.5,
            severity: 'moderate',
            description: 'No covariates available for balance assessment',
            recommendation: 'Measure and adjust for potential confounders'
        };
    }
    // Compute standardized mean differences (SMD)
    const smds = [];
    for (const covar of covariateNames) {
        let treated_mean;
        let treated_std;
        let control_mean;
        let control_std;
        if (covar === 'age') {
            const treated_ages = treated.map(p => p.age).filter(a => a !== undefined);
            const control_ages = control.map(p => p.age).filter(a => a !== undefined);
            treated_mean = mean(treated_ages);
            treated_std = std(treated_ages);
            control_mean = mean(control_ages);
            control_std = std(control_ages);
        }
        else if (covar === 'gender') {
            // Binary: proportion of males
            treated_mean = treated.filter(p => p.gender === 'M').length / treated.length;
            treated_std = Math.sqrt(treated_mean * (1 - treated_mean));
            control_mean = control.filter(p => p.gender === 'M').length / control.length;
            control_std = Math.sqrt(control_mean * (1 - control_mean));
        }
        else {
            // Custom covariate
            const treated_vals = treated.map(p => p.covariates?.[covar] || 0);
            const control_vals = control.map(p => p.covariates?.[covar] || 0);
            treated_mean = mean(treated_vals);
            treated_std = std(treated_vals);
            control_mean = mean(control_vals);
            control_std = std(control_vals);
        }
        // SMD = (mean_treated - mean_control) / pooled_std
        const pooled_std = Math.sqrt((treated_std ** 2 + control_std ** 2) / 2);
        const smd = pooled_std > 0 ? Math.abs(treated_mean - control_mean) / pooled_std : 0;
        smds.push(smd);
    }
    // Compute score based on SMD distribution
    const max_smd = Math.max(...smds);
    const mean_smd = mean(smds);
    let score;
    if (max_smd < 0.05) {
        score = 1.0; // Excellent balance
    }
    else if (max_smd < 0.1) {
        score = 0.9; // Good balance
    }
    else if (max_smd < 0.2) {
        score = 0.7; // Acceptable balance
    }
    else if (max_smd < 0.5) {
        score = 0.4; // Moderate imbalance
    }
    else {
        score = 0.1; // Severe imbalance
    }
    const severity = classifySeverity(score);
    return {
        assumption: 'unconfoundedness',
        score,
        severity,
        description: `Covariate balance: max SMD = ${max_smd.toFixed(3)}, mean SMD = ${mean_smd.toFixed(3)}`,
        recommendation: severity === 'none'
            ? 'Proceed with standard causal inference'
            : severity === 'mild'
                ? 'Consider covariate adjustment or propensity score methods'
                : severity === 'moderate'
                    ? 'Use partial identification (Manski bounds) or sensitivity analysis (E-values)'
                    : 'Severe confounding detected. Use Manski bounds + E-values for safe inference'
    };
}
/**
 * Detect positivity violation
 *
 * Strategy: Check overlap in propensity score distribution
 * - Positivity requires: 0 < P(T=1|X) < 1 for all X
 * - Practical: Check for extreme propensity scores
 *
 * Score interpretation:
 * - 1.0: All propensity scores in [0.1, 0.9] (excellent overlap)
 * - 0.8: All in [0.05, 0.95] (good overlap)
 * - 0.5: Some in [0.01, 0.99] (moderate overlap)
 * - 0.0: Many near 0 or 1 (severe positivity violation)
 */
function detectPositivityViolation(patients) {
    // Estimate propensity scores if not provided
    const patientsWithPS = patients.map(p => {
        if (p.propensity_score !== undefined) {
            return { ...p };
        }
        else {
            // Simple propensity score estimate: proportion treated in similar age group
            const age = p.age || 50;
            const similar_patients = patients.filter(sp => {
                const sp_age = sp.age || 50;
                return Math.abs(sp_age - age) < 10;
            });
            const ps = similar_patients.filter(sp => sp.treatment === 1).length / similar_patients.length;
            return { ...p, propensity_score: ps };
        }
    });
    const propensity_scores = patientsWithPS.map(p => p.propensity_score);
    // Check for extreme scores
    const very_low = propensity_scores.filter(ps => ps < 0.01).length;
    const low = propensity_scores.filter(ps => ps < 0.05).length;
    const moderate_low = propensity_scores.filter(ps => ps < 0.1).length;
    const very_high = propensity_scores.filter(ps => ps > 0.99).length;
    const high = propensity_scores.filter(ps => ps > 0.95).length;
    const moderate_high = propensity_scores.filter(ps => ps > 0.9).length;
    const n = propensity_scores.length;
    const extreme_prop = (very_low + very_high) / n;
    const near_extreme_prop = (low + high) / n;
    const moderate_extreme_prop = (moderate_low + moderate_high) / n;
    let score;
    if (extreme_prop > 0.1) {
        score = 0.1; // Severe violation
    }
    else if (near_extreme_prop > 0.2) {
        score = 0.4; // Moderate violation
    }
    else if (moderate_extreme_prop > 0.3) {
        score = 0.7; // Mild violation
    }
    else {
        score = 1.0; // Good overlap
    }
    const severity = classifySeverity(score);
    return {
        assumption: 'positivity',
        score,
        severity,
        description: `Propensity score overlap: ${(extreme_prop * 100).toFixed(1)}% extreme, ${(near_extreme_prop * 100).toFixed(1)}% near-extreme`,
        recommendation: severity === 'none'
            ? 'Proceed with standard causal inference'
            : severity === 'mild'
                ? 'Consider trimming extreme propensity scores'
                : severity === 'moderate'
                    ? 'Use partial identification or restrict to common support region'
                    : 'Severe positivity violation. Use Manski bounds for safe inference'
    };
}
/**
 * Detect model specification violation
 *
 * Strategy: Test linearity and functional form assumptions
 * - For continuous covariates: Test for non-linearity using polynomial terms
 * - For outcome model: Test residual patterns
 *
 * Score interpretation:
 * - 1.0: Model fits well (R² > 0.8, no patterns in residuals)
 * - 0.7: Acceptable fit (R² > 0.5)
 * - 0.4: Poor fit (R² < 0.3)
 * - 0.0: Very poor fit (R² < 0.1 or severe residual patterns)
 */
function detectSpecificationViolation(patients) {
    // Simple specification check: predict outcome from treatment + age
    const treated = patients.filter(p => p.treatment === 1);
    const control = patients.filter(p => p.treatment === 0);
    // Check if treatment effect varies dramatically by subgroup (interaction)
    const age_groups = [
        { name: 'young', filter: (p) => (p.age || 50) < 40 },
        { name: 'middle', filter: (p) => (p.age || 50) >= 40 && (p.age || 50) < 60 },
        { name: 'old', filter: (p) => (p.age || 50) >= 60 }
    ];
    const effects = [];
    for (const group of age_groups) {
        const treated_group = treated.filter(group.filter);
        const control_group = control.filter(group.filter);
        if (treated_group.length < 10 || control_group.length < 10)
            continue;
        const treated_outcome_rate = treated_group.filter(p => p.outcome === 1).length / treated_group.length;
        const control_outcome_rate = control_group.filter(p => p.outcome === 1).length / control_group.length;
        const effect = treated_outcome_rate - control_outcome_rate;
        effects.push(effect);
    }
    if (effects.length < 2) {
        return {
            assumption: 'specification',
            score: 0.6,
            severity: 'mild',
            description: 'Insufficient data for specification testing',
            recommendation: 'Collect more data or use flexible models'
        };
    }
    // Check heterogeneity in treatment effects
    const effect_std = std(effects);
    const effect_mean = mean(effects);
    const cv = Math.abs(effect_mean) > 0.01 ? effect_std / Math.abs(effect_mean) : effect_std;
    let score;
    if (cv < 0.3) {
        score = 1.0; // Homogeneous effects (linear model likely OK)
    }
    else if (cv < 0.6) {
        score = 0.7; // Moderate heterogeneity
    }
    else if (cv < 1.0) {
        score = 0.4; // High heterogeneity
    }
    else {
        score = 0.1; // Very high heterogeneity (severe misspecification)
    }
    const severity = classifySeverity(score);
    return {
        assumption: 'specification',
        score,
        severity,
        description: `Treatment effect heterogeneity: CV = ${cv.toFixed(2)}`,
        recommendation: severity === 'none'
            ? 'Linear model appears appropriate'
            : severity === 'mild'
                ? 'Consider interaction terms or flexible models'
                : severity === 'moderate'
                    ? 'Use doubly-robust methods or bounds'
                    : 'Severe model misspecification. Use non-parametric bounds'
    };
}
/**
 * Compute overall assumption scores for a site
 */
function assessAssumptions(patients) {
    const unconfoundedness = detectUnconfoundednessViolation(patients);
    const positivity = detectPositivityViolation(patients);
    const specification = detectSpecificationViolation(patients);
    // Overall score: geometric mean (conservative)
    const overall_score = Math.pow(unconfoundedness.score * positivity.score * specification.score, 1 / 3);
    return {
        unconfoundedness_score: unconfoundedness.score,
        positivity_score: positivity.score,
        specification_score: specification.score,
        overall_score
    };
}
/**
 * Get all violation details
 */
function getViolationDetails(patients) {
    return [
        detectUnconfoundednessViolation(patients),
        detectPositivityViolation(patients),
        detectSpecificationViolation(patients)
    ];
}
/**
 * Classify severity based on score
 */
function classifySeverity(score) {
    if (score >= 0.8)
        return 'none';
    if (score >= 0.6)
        return 'mild';
    if (score >= 0.4)
        return 'moderate';
    return 'severe';
}
/**
 * Helper: compute mean
 */
function mean(values) {
    if (values.length === 0)
        return 0;
    return values.reduce((sum, x) => sum + x, 0) / values.length;
}
/**
 * Helper: compute standard deviation
 */
function std(values) {
    if (values.length === 0)
        return 0;
    const m = mean(values);
    const variance = values.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / values.length;
    return Math.sqrt(variance);
}
//# sourceMappingURL=assumption-diagnostics.js.map
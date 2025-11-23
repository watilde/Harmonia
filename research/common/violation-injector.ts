/**
 * Assumption Violation Injector
 * 
 * Artificially injects various types of assumption violations into Synthea data
 * to test the design-failure-aware framework:
 * 
 * 1. Unconfoundedness violations: Induce covariate imbalance
 * 2. Positivity violations: Create extreme propensity scores
 * 3. Model misspecification: Induce treatment effect heterogeneity
 */

export interface Patient {
  person_id: string;
  treatment: 0 | 1;
  outcome: 0 | 1;
  age?: number;
  gender?: string;
  covariates?: Record<string, number>;
  propensity_score?: number;
}

export interface ViolationScenario {
  name: string;
  description: string;
  violation_type: 'unconfoundedness' | 'positivity' | 'specification' | 'combined';
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  expected_score_range: { min: number; max: number };
}

export interface ViolationResult {
  scenario: ViolationScenario;
  original_patients: Patient[];
  violated_patients: Patient[];
  violation_stats: {
    covariate_imbalance?: number; // SMD
    propensity_extremes?: number; // % with extreme PS
    effect_heterogeneity?: number; // CV of effects
  };
}

/**
 * Generate all violation scenarios
 */
export function generateViolationScenarios(): ViolationScenario[] {
  return [
    // Baseline: No violation
    {
      name: 'No Violation',
      description: 'Baseline scenario with all assumptions satisfied',
      violation_type: 'unconfoundedness',
      severity: 'none',
      expected_score_range: { min: 0.9, max: 1.0 }
    },
    
    // Unconfoundedness violations
    {
      name: 'Mild Unconfoundedness Violation',
      description: 'Slight covariate imbalance (SMD ≈ 0.15)',
      violation_type: 'unconfoundedness',
      severity: 'mild',
      expected_score_range: { min: 0.7, max: 0.9 }
    },
    {
      name: 'Moderate Unconfoundedness Violation',
      description: 'Moderate covariate imbalance (SMD ≈ 0.3)',
      violation_type: 'unconfoundedness',
      severity: 'moderate',
      expected_score_range: { min: 0.4, max: 0.7 }
    },
    {
      name: 'Severe Unconfoundedness Violation',
      description: 'Severe covariate imbalance (SMD ≈ 0.6)',
      violation_type: 'unconfoundedness',
      severity: 'severe',
      expected_score_range: { min: 0.0, max: 0.4 }
    },
    
    // Positivity violations
    {
      name: 'Mild Positivity Violation',
      description: 'Some propensity scores near extremes (5-10% extreme)',
      violation_type: 'positivity',
      severity: 'mild',
      expected_score_range: { min: 0.7, max: 0.9 }
    },
    {
      name: 'Moderate Positivity Violation',
      description: 'Many propensity scores near extremes (15-25% extreme)',
      violation_type: 'positivity',
      severity: 'moderate',
      expected_score_range: { min: 0.4, max: 0.7 }
    },
    {
      name: 'Severe Positivity Violation',
      description: 'Most propensity scores extreme (>30% extreme)',
      violation_type: 'positivity',
      severity: 'severe',
      expected_score_range: { min: 0.0, max: 0.4 }
    },
    
    // Specification violations
    {
      name: 'Mild Specification Violation',
      description: 'Moderate treatment effect heterogeneity (CV ≈ 0.4)',
      violation_type: 'specification',
      severity: 'mild',
      expected_score_range: { min: 0.7, max: 0.9 }
    },
    {
      name: 'Moderate Specification Violation',
      description: 'High treatment effect heterogeneity (CV ≈ 0.8)',
      violation_type: 'specification',
      severity: 'moderate',
      expected_score_range: { min: 0.4, max: 0.7 }
    },
    {
      name: 'Severe Specification Violation',
      description: 'Very high treatment effect heterogeneity (CV ≈ 1.5)',
      violation_type: 'specification',
      severity: 'severe',
      expected_score_range: { min: 0.0, max: 0.4 }
    },
    
    // Combined violations
    {
      name: 'Combined Moderate Violations',
      description: 'Moderate violations across all assumptions',
      violation_type: 'combined',
      severity: 'moderate',
      expected_score_range: { min: 0.3, max: 0.6 }
    },
    {
      name: 'Combined Severe Violations',
      description: 'Severe violations across all assumptions',
      violation_type: 'combined',
      severity: 'severe',
      expected_score_range: { min: 0.0, max: 0.3 }
    }
  ];
}

/**
 * Inject unconfoundedness violation (covariate imbalance)
 * 
 * Strategy: Selectively assign treatment based on age to create imbalance
 */
export function injectUnconfoundednessViolation(
  patients: Patient[],
  severity: 'mild' | 'moderate' | 'severe'
): Patient[] {
  const violated = patients.map(p => ({ ...p }));
  
  // Determine imbalance strength based on severity
  const imbalance_strength = severity === 'mild' ? 0.3 : severity === 'moderate' ? 0.6 : 0.9;
  
  // Sort by age
  const sorted = [...violated].sort((a, b) => (a.age || 50) - (b.age || 50));
  
  // Assign treatment preferentially to older patients
  const n_treated_target = Math.floor(violated.length * 0.5); // Keep 50% treatment rate
  
  for (let i = 0; i < sorted.length; i++) {
    const patient = sorted[i];
    const age = patient.age || 50;
    
    // Probability of treatment increases with age
    const age_factor = age / 100; // 0 to 1 scale
    const p_treatment = 0.5 + imbalance_strength * (age_factor - 0.5);
    
    patient.treatment = Math.random() < p_treatment ? 1 : 0;
  }
  
  // Ensure we have approximately n_treated_target treated patients
  const n_treated_actual = sorted.filter(p => p.treatment === 1).length;
  if (Math.abs(n_treated_actual - n_treated_target) > n_treated_target * 0.2) {
    // Adjust to get closer to target
    const need_more_treated = n_treated_actual < n_treated_target;
    const diff = Math.abs(n_treated_actual - n_treated_target);
    
    let adjusted = 0;
    for (let i = 0; i < sorted.length && adjusted < diff; i++) {
      if (need_more_treated && sorted[i].treatment === 0) {
        sorted[i].treatment = 1;
        adjusted++;
      } else if (!need_more_treated && sorted[i].treatment === 1) {
        sorted[i].treatment = 0;
        adjusted++;
      }
    }
  }
  
  return sorted;
}

/**
 * Inject positivity violation (extreme propensity scores)
 * 
 * Strategy: Create subgroups with very high or very low treatment probabilities
 */
export function injectPositivityViolation(
  patients: Patient[],
  severity: 'mild' | 'moderate' | 'severe'
): Patient[] {
  const violated = patients.map(p => ({ ...p }));
  
  // Determine extremeness based on severity
  const low_ps = severity === 'mild' ? 0.10 : severity === 'moderate' ? 0.05 : 0.02;
  const high_ps = severity === 'mild' ? 0.90 : severity === 'moderate' ? 0.95 : 0.98;
  
  // Create age-based strata
  const young = violated.filter(p => (p.age || 50) < 40);
  const middle = violated.filter(p => (p.age || 50) >= 40 && (p.age || 50) < 60);
  const old = violated.filter(p => (p.age || 50) >= 60);
  
  // Assign extreme treatment probabilities
  // Young: mostly untreated
  young.forEach(p => {
    p.treatment = Math.random() < low_ps ? 1 : 0;
  });
  
  // Old: mostly treated
  old.forEach(p => {
    p.treatment = Math.random() < high_ps ? 1 : 0;
  });
  
  // Middle: balanced
  const middle_treatment_rate = 0.5;
  middle.forEach(p => {
    p.treatment = Math.random() < middle_treatment_rate ? 1 : 0;
  });
  
  // Combine back
  return [...young, ...middle, ...old];
}

/**
 * Inject model specification violation (treatment effect heterogeneity)
 * 
 * Strategy: Make treatment effect vary dramatically by age group
 */
export function injectSpecificationViolation(
  patients: Patient[],
  severity: 'mild' | 'moderate' | 'severe'
): Patient[] {
  const violated = patients.map(p => ({ ...p }));
  
  // Determine heterogeneity strength
  const hetero_strength = severity === 'mild' ? 0.5 : severity === 'moderate' ? 1.0 : 2.0;
  
  // Modify outcomes based on age and treatment
  for (const patient of violated) {
    const age = patient.age || 50;
    const age_factor = (age - 50) / 50; // -1 to 1 scale
    
    if (patient.treatment === 1) {
      // Treatment effect varies by age
      // Young: large positive effect
      // Old: small or negative effect
      const treatment_benefit = 0.3 - hetero_strength * age_factor * 0.3;
      
      const baseline_outcome_prob = 0.3; // Base probability
      const treated_outcome_prob = Math.min(0.9, Math.max(0.1, baseline_outcome_prob + treatment_benefit));
      
      patient.outcome = Math.random() < treated_outcome_prob ? 1 : 0;
    } else {
      // Control: outcome probability varies by age
      const control_outcome_prob = 0.2 + age_factor * 0.1;
      patient.outcome = Math.random() < control_outcome_prob ? 1 : 0;
    }
  }
  
  return violated;
}

/**
 * Inject combined violations
 */
export function injectCombinedViolations(
  patients: Patient[],
  severity: 'moderate' | 'severe'
): Patient[] {
  let violated = patients.map(p => ({ ...p }));
  
  const component_severity: 'mild' | 'moderate' | 'severe' = 
    severity === 'moderate' ? 'mild' : 'moderate';
  
  // Apply all violations sequentially
  violated = injectUnconfoundednessViolation(violated, component_severity);
  violated = injectPositivityViolation(violated, component_severity);
  violated = injectSpecificationViolation(violated, component_severity);
  
  return violated;
}

/**
 * Inject violation based on scenario
 */
export function injectViolation(
  patients: Patient[],
  scenario: ViolationScenario
): ViolationResult {
  const original_patients = patients.map(p => ({ ...p }));
  let violated_patients: Patient[];
  
  if (scenario.severity === 'none') {
    // No violation: return copy of original
    violated_patients = patients.map(p => ({ ...p }));
  } else if (scenario.violation_type === 'unconfoundedness') {
    violated_patients = injectUnconfoundednessViolation(patients, scenario.severity as any);
  } else if (scenario.violation_type === 'positivity') {
    violated_patients = injectPositivityViolation(patients, scenario.severity as any);
  } else if (scenario.violation_type === 'specification') {
    violated_patients = injectSpecificationViolation(patients, scenario.severity as any);
  } else {
    // Combined
    violated_patients = injectCombinedViolations(patients, scenario.severity as any);
  }
  
  // Compute violation statistics
  const violation_stats = computeViolationStats(violated_patients, scenario.violation_type);
  
  return {
    scenario,
    original_patients,
    violated_patients,
    violation_stats
  };
}

/**
 * Compute statistics about the injected violation
 */
function computeViolationStats(
  patients: Patient[],
  violation_type: string
): ViolationResult['violation_stats'] {
  const stats: ViolationResult['violation_stats'] = {};
  
  // Covariate imbalance (SMD for age)
  if (violation_type === 'unconfoundedness' || violation_type === 'combined') {
    const treated = patients.filter(p => p.treatment === 1);
    const control = patients.filter(p => p.treatment === 0);
    
    const treated_ages = treated.map(p => p.age || 50);
    const control_ages = control.map(p => p.age || 50);
    
    const mean_t = treated_ages.reduce((sum, a) => sum + a, 0) / treated_ages.length;
    const mean_c = control_ages.reduce((sum, a) => sum + a, 0) / control_ages.length;
    
    const std_t = Math.sqrt(
      treated_ages.reduce((sum, a) => sum + Math.pow(a - mean_t, 2), 0) / treated_ages.length
    );
    const std_c = Math.sqrt(
      control_ages.reduce((sum, a) => sum + Math.pow(a - mean_c, 2), 0) / control_ages.length
    );
    
    const pooled_std = Math.sqrt((std_t ** 2 + std_c ** 2) / 2);
    const smd = pooled_std > 0 ? Math.abs(mean_t - mean_c) / pooled_std : 0;
    
    stats.covariate_imbalance = smd;
  }
  
  // Propensity extremes
  if (violation_type === 'positivity' || violation_type === 'combined') {
    // Estimate simple propensity scores
    const age_groups = new Map<number, { treated: number; total: number }>();
    
    for (const p of patients) {
      const age_group = Math.floor((p.age || 50) / 10) * 10;
      const current = age_groups.get(age_group) || { treated: 0, total: 0 };
      current.total++;
      if (p.treatment === 1) current.treated++;
      age_groups.set(age_group, current);
    }
    
    let extreme_count = 0;
    for (const p of patients) {
      const age_group = Math.floor((p.age || 50) / 10) * 10;
      const group_stats = age_groups.get(age_group)!;
      const ps = group_stats.treated / group_stats.total;
      
      if (ps < 0.05 || ps > 0.95) {
        extreme_count++;
      }
    }
    
    stats.propensity_extremes = extreme_count / patients.length;
  }
  
  // Effect heterogeneity
  if (violation_type === 'specification' || violation_type === 'combined') {
    const age_groups = [
      { name: 'young', filter: (p: Patient) => (p.age || 50) < 40 },
      { name: 'middle', filter: (p: Patient) => (p.age || 50) >= 40 && (p.age || 50) < 60 },
      { name: 'old', filter: (p: Patient) => (p.age || 50) >= 60 }
    ];
    
    const effects: number[] = [];
    
    for (const group of age_groups) {
      const group_patients = patients.filter(group.filter);
      const treated = group_patients.filter(p => p.treatment === 1);
      const control = group_patients.filter(p => p.treatment === 0);
      
      if (treated.length < 5 || control.length < 5) continue;
      
      const treated_outcome_rate = treated.filter(p => p.outcome === 1).length / treated.length;
      const control_outcome_rate = control.filter(p => p.outcome === 1).length / control.length;
      const effect = treated_outcome_rate - control_outcome_rate;
      
      effects.push(effect);
    }
    
    if (effects.length >= 2) {
      const mean_effect = effects.reduce((sum, e) => sum + e, 0) / effects.length;
      const std_effect = Math.sqrt(
        effects.reduce((sum, e) => sum + Math.pow(e - mean_effect, 2), 0) / effects.length
      );
      const cv = Math.abs(mean_effect) > 0.01 ? std_effect / Math.abs(mean_effect) : std_effect;
      
      stats.effect_heterogeneity = cv;
    }
  }
  
  return stats;
}

/**
 * Print violation result summary
 */
export function printViolationSummary(result: ViolationResult): void {
  console.log('');
  console.log('─'.repeat(70));
  console.log(`Violation Scenario: ${result.scenario.name}`);
  console.log('─'.repeat(70));
  console.log('');
  console.log(`Description: ${result.scenario.description}`);
  console.log(`Type: ${result.scenario.violation_type}`);
  console.log(`Severity: ${result.scenario.severity}`);
  console.log(`Expected Score Range: [${result.scenario.expected_score_range.min.toFixed(2)}, ${result.scenario.expected_score_range.max.toFixed(2)}]`);
  console.log('');
  
  console.log('Violation Statistics:');
  if (result.violation_stats.covariate_imbalance !== undefined) {
    console.log(`  Covariate Imbalance (SMD): ${result.violation_stats.covariate_imbalance.toFixed(3)}`);
  }
  if (result.violation_stats.propensity_extremes !== undefined) {
    console.log(`  Propensity Extremes:       ${(result.violation_stats.propensity_extremes * 100).toFixed(1)}%`);
  }
  if (result.violation_stats.effect_heterogeneity !== undefined) {
    console.log(`  Effect Heterogeneity (CV): ${result.violation_stats.effect_heterogeneity.toFixed(3)}`);
  }
  console.log('');
  console.log('─'.repeat(70));
  console.log('');
}

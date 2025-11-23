/**
 * Confounding Injector
 * 
 * Artificially inject unmeasured confounding into Synthea data
 * with controlled strength for E-value validation experiments.
 * 
 * Strategy: Generate latent confounder U that affects both T and Y
 * with specified association strengths (RR_TU, RR_YU).
 */

export interface Patient {
  person_id: string;
  treatment: 0 | 1;
  outcome: 0 | 1;
  age?: number;
  gender?: string;
  // Injected fields
  confounder?: 0 | 1;  // Latent unmeasured confounder U
  original_treatment?: 0 | 1;  // Treatment before confounding
  original_outcome?: 0 | 1;    // Outcome before confounding
}

export interface ConfoundingParams {
  RR_TU: number;  // Risk ratio: P(T=1|U=1) / P(T=1|U=0)
  RR_YU: number;  // Risk ratio: P(Y=1|U=1) / P(Y=1|U=0)
  prevalence_U: number;  // P(U=1) - prevalence of confounder
}

export interface InjectionResult {
  patients: Patient[];
  params: ConfoundingParams;
  statistics: {
    // Before confounding
    original_ate: number;
    original_treatment_rate: number;
    original_outcome_rate: number;
    
    // After confounding
    confounded_ate: number;
    confounded_treatment_rate: number;
    confounded_outcome_rate: number;
    
    // Bias metrics
    bias: number;  // confounded_ate - original_ate
    relative_bias: number;  // bias / original_ate
    
    // Confounder prevalence
    u_prevalence: number;
    
    // Observed associations
    observed_RR_TU: number;
    observed_RR_YU: number;
  };
}

/**
 * Inject unmeasured confounding into patient data
 * 
 * Algorithm:
 * 1. Generate latent confounder U ~ Bernoulli(prevalence_U)
 * 2. Modify treatment T based on U with strength RR_TU
 * 3. Modify outcome Y based on U with strength RR_YU
 * 4. Return confounded data (U not observed)
 * 
 * @param patients - Original patient data
 * @param params - Confounding parameters
 * @returns Patients with injected confounding
 */
export function injectConfounding(
  patients: Patient[],
  params: ConfoundingParams
): InjectionResult {
  // Validate parameters
  if (params.RR_TU < 1 || params.RR_YU < 1) {
    throw new Error('Risk ratios must be >= 1');
  }
  if (params.prevalence_U <= 0 || params.prevalence_U >= 1) {
    throw new Error('Confounder prevalence must be in (0, 1)');
  }
  
  // Compute original statistics
  const original_stats = computeStatistics(patients);
  
  // Deep copy patients
  const confounded_patients: Patient[] = patients.map(p => ({
    ...p,
    original_treatment: p.treatment,
    original_outcome: p.outcome
  }));
  
  // Step 1: Generate confounder U for each patient
  for (const patient of confounded_patients) {
    patient.confounder = Math.random() < params.prevalence_U ? 1 : 0;
  }
  
  // Step 2: Modify treatment based on U
  confounded_patients.forEach(p => {
    p.treatment = modifyTreatment(p.original_treatment!, p.confounder!, params.RR_TU);
  });
  
  // Step 3: Modify outcome based on U
  confounded_patients.forEach(p => {
    p.outcome = modifyOutcome(p.original_outcome!, p.confounder!, params.RR_YU);
  });
  
  // Compute confounded statistics
  const confounded_stats = computeStatistics(confounded_patients);
  
  // Compute bias
  const bias = confounded_stats.ate - original_stats.ate;
  const relative_bias = original_stats.ate !== 0 ? bias / original_stats.ate : 0;
  
  // Observed associations (check if we achieved target RRs)
  const observed_RR_TU = computeObservedRR_TU(confounded_patients);
  const observed_RR_YU = computeObservedRR_YU(confounded_patients);
  
  return {
    patients: confounded_patients,
    params,
    statistics: {
      original_ate: original_stats.ate,
      original_treatment_rate: original_stats.treatment_rate,
      original_outcome_rate: original_stats.outcome_rate,
      confounded_ate: confounded_stats.ate,
      confounded_treatment_rate: confounded_stats.treatment_rate,
      confounded_outcome_rate: confounded_stats.outcome_rate,
      bias,
      relative_bias,
      u_prevalence: params.prevalence_U,
      observed_RR_TU,
      observed_RR_YU
    }
  };
}

/**
 * Modify treatment based on confounder
 * 
 * Use inverse transform sampling to achieve target RR_TU
 */
function modifyTreatment(T_original: 0 | 1, U: 0 | 1, RR_TU: number): 0 | 1 {
  if (RR_TU === 1) {
    return T_original; // No confounding
  }
  
  // Probability of treatment given U
  // We want: P(T=1|U=1) / P(T=1|U=0) = RR_TU
  
  // Simple approach: increase treatment probability if U=1
  if (U === 1) {
    // Increase probability of T=1
    const boost = Math.min(0.3, (RR_TU - 1) * 0.15); // Scale factor
    if (T_original === 0) {
      // Flip to T=1 with probability proportional to RR_TU
      return Math.random() < boost ? 1 : 0;
    } else {
      return 1; // Keep T=1
    }
  } else {
    // U=0: reduce probability of T=1
    const reduce = Math.min(0.2, (RR_TU - 1) * 0.1);
    if (T_original === 1) {
      return Math.random() < reduce ? 0 : 1;
    } else {
      return 0;
    }
  }
}

/**
 * Modify outcome based on confounder
 */
function modifyOutcome(Y_original: 0 | 1, U: 0 | 1, RR_YU: number): 0 | 1 {
  if (RR_YU === 1) {
    return Y_original; // No confounding
  }
  
  // Similar logic as treatment
  if (U === 1) {
    const boost = Math.min(0.3, (RR_YU - 1) * 0.15);
    if (Y_original === 0) {
      return Math.random() < boost ? 1 : 0;
    } else {
      return 1;
    }
  } else {
    const reduce = Math.min(0.2, (RR_YU - 1) * 0.1);
    if (Y_original === 1) {
      return Math.random() < reduce ? 0 : 1;
    } else {
      return 0;
    }
  }
}

/**
 * Compute basic statistics
 */
function computeStatistics(patients: Patient[]): {
  ate: number;
  treatment_rate: number;
  outcome_rate: number;
} {
  const treated = patients.filter(p => p.treatment === 1);
  const control = patients.filter(p => p.treatment === 0);
  
  const n_treated = treated.length;
  const n_control = control.length;
  
  if (n_treated === 0 || n_control === 0) {
    throw new Error('Need both treated and control patients');
  }
  
  const outcome_rate_treated = treated.filter(p => p.outcome === 1).length / n_treated;
  const outcome_rate_control = control.filter(p => p.outcome === 1).length / n_control;
  
  const ate = outcome_rate_treated - outcome_rate_control;
  const treatment_rate = n_treated / patients.length;
  const outcome_rate = patients.filter(p => p.outcome === 1).length / patients.length;
  
  return { ate, treatment_rate, outcome_rate };
}

/**
 * Compute observed RR_TU from confounded data
 */
function computeObservedRR_TU(patients: Patient[]): number {
  const u1 = patients.filter(p => p.confounder === 1);
  const u0 = patients.filter(p => p.confounder === 0);
  
  if (u1.length === 0 || u0.length === 0) {
    return 1;
  }
  
  const p_t1_u1 = u1.filter(p => p.treatment === 1).length / u1.length;
  const p_t1_u0 = u0.filter(p => p.treatment === 1).length / u0.length;
  
  return p_t1_u0 > 0 ? p_t1_u1 / p_t1_u0 : 1;
}

/**
 * Compute observed RR_YU from confounded data
 */
function computeObservedRR_YU(patients: Patient[]): number {
  const u1 = patients.filter(p => p.confounder === 1);
  const u0 = patients.filter(p => p.confounder === 0);
  
  if (u1.length === 0 || u0.length === 0) {
    return 1;
  }
  
  const p_y1_u1 = u1.filter(p => p.outcome === 1).length / u1.length;
  const p_y1_u0 = u0.filter(p => p.outcome === 1).length / u0.length;
  
  return p_y1_u0 > 0 ? p_y1_u1 / p_y1_u0 : 1;
}

/**
 * Generate confounding scenarios for experiments
 */
export function generateConfoundingScenarios(): ConfoundingParams[] {
  const scenarios: ConfoundingParams[] = [];
  
  // No confounding (baseline)
  scenarios.push({
    RR_TU: 1.0,
    RR_YU: 1.0,
    prevalence_U: 0.5
  });
  
  // Weak confounding
  scenarios.push({
    RR_TU: 1.5,
    RR_YU: 1.5,
    prevalence_U: 0.3
  });
  
  // Moderate confounding
  scenarios.push({
    RR_TU: 2.0,
    RR_YU: 2.0,
    prevalence_U: 0.3
  });
  
  // Strong confounding
  scenarios.push({
    RR_TU: 3.0,
    RR_YU: 3.0,
    prevalence_U: 0.3
  });
  
  // Very strong confounding
  scenarios.push({
    RR_TU: 4.0,
    RR_YU: 4.0,
    prevalence_U: 0.3
  });
  
  // Asymmetric confounding (strong on T, weak on Y)
  scenarios.push({
    RR_TU: 3.0,
    RR_YU: 1.5,
    prevalence_U: 0.3
  });
  
  // Asymmetric confounding (weak on T, strong on Y)
  scenarios.push({
    RR_TU: 1.5,
    RR_YU: 3.0,
    prevalence_U: 0.3
  });
  
  return scenarios;
}

/**
 * Print injection results
 */
export function printInjectionSummary(result: InjectionResult): void {
  console.log('');
  console.log('═'.repeat(70));
  console.log('  Confounding Injection Summary');
  console.log('═'.repeat(70));
  console.log('');
  
  console.log('Confounding Parameters:');
  console.log(`  RR_TU (T-U association):  ${result.params.RR_TU.toFixed(2)}`);
  console.log(`  RR_YU (Y-U association):  ${result.params.RR_YU.toFixed(2)}`);
  console.log(`  Prevalence of U:          ${result.params.prevalence_U.toFixed(2)}`);
  console.log('');
  
  console.log('Original Data (No Confounding):');
  console.log(`  ATE:            ${result.statistics.original_ate.toFixed(4)}`);
  console.log(`  Treatment rate: ${(result.statistics.original_treatment_rate * 100).toFixed(1)}%`);
  console.log(`  Outcome rate:   ${(result.statistics.original_outcome_rate * 100).toFixed(1)}%`);
  console.log('');
  
  console.log('Confounded Data:');
  console.log(`  ATE:            ${result.statistics.confounded_ate.toFixed(4)}`);
  console.log(`  Treatment rate: ${(result.statistics.confounded_treatment_rate * 100).toFixed(1)}%`);
  console.log(`  Outcome rate:   ${(result.statistics.confounded_outcome_rate * 100).toFixed(1)}%`);
  console.log('');
  
  console.log('Bias Induced:');
  console.log(`  Absolute bias:  ${result.statistics.bias.toFixed(4)}`);
  console.log(`  Relative bias:  ${(result.statistics.relative_bias * 100).toFixed(1)}%`);
  console.log('');
  
  console.log('Observed Associations (achieved):');
  console.log(`  RR_TU observed: ${result.statistics.observed_RR_TU.toFixed(2)} (target: ${result.params.RR_TU.toFixed(2)})`);
  console.log(`  RR_YU observed: ${result.statistics.observed_RR_YU.toFixed(2)} (target: ${result.params.RR_YU.toFixed(2)})`);
  console.log('');
  
  console.log('═'.repeat(70));
  console.log('');
}

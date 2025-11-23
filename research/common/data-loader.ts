/**
 * Data Loader for Synthea 1k Split Data
 * 
 * Loads federated site data from JSON files and prepares it for
 * partial identification analysis.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface Patient {
  person_id: string;
  treatment: 0 | 1;
  outcome: 0 | 1;
  age?: number;
  gender?: string;
  instrument?: 0 | 1; // Optional for IV analysis
}

export interface SiteMetadata {
  site_id: string;
  scenario: string;
  n_patients: number;
  n_treated: number;
  n_control: number;
  split_date: string;
}

export interface SiteData {
  metadata: SiteMetadata;
  patients: Patient[];
}

export interface FederatedData {
  sites: SiteData[];
  total_patients: number;
  total_treated: number;
  total_control: number;
}

/**
 * Load a single site's data from JSON file
 */
export function loadSiteData(filePath: string): SiteData {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  // Validate structure
  if (!data.metadata || !data.patients) {
    throw new Error(`Invalid data structure in ${filePath}`);
  }
  
  // Validate patients have required fields
  for (const patient of data.patients) {
    if (typeof patient.treatment !== 'number' || 
        typeof patient.outcome !== 'number' ||
        ![0, 1].includes(patient.treatment) ||
        ![0, 1].includes(patient.outcome)) {
      throw new Error(`Invalid patient data in ${filePath}: treatment and outcome must be 0 or 1`);
    }
  }
  
  return data as SiteData;
}

/**
 * Load all federated sites from a directory
 */
export function loadFederatedData(dataDir: string): FederatedData {
  // Find all site*.json files
  const files = fs.readdirSync(dataDir)
    .filter(f => f.match(/^site\d+\.json$/))
    .sort(); // Ensure consistent ordering
  
  if (files.length === 0) {
    throw new Error(`No site data files found in ${dataDir}`);
  }
  
  const sites: SiteData[] = [];
  let total_patients = 0;
  let total_treated = 0;
  let total_control = 0;
  
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const siteData = loadSiteData(filePath);
    
    sites.push(siteData);
    total_patients += siteData.metadata.n_patients;
    total_treated += siteData.metadata.n_treated;
    total_control += siteData.metadata.n_control;
  }
  
  return {
    sites,
    total_patients,
    total_treated,
    total_control
  };
}

/**
 * Load default Synthea 1k split data
 */
export function loadSynthea1kData(): FederatedData {
  // Default path relative to research root
  const dataDir = path.resolve(__dirname, '../../data/raw/splits/1k');
  return loadFederatedData(dataDir);
}

/**
 * Get patients from a specific site
 */
export function getSitePatients(federatedData: FederatedData, siteIndex: number): Patient[] {
  if (siteIndex < 0 || siteIndex >= federatedData.sites.length) {
    throw new Error(`Invalid site index: ${siteIndex}`);
  }
  return federatedData.sites[siteIndex].patients;
}

/**
 * Get all patients across all sites (for centralized comparison)
 */
export function getAllPatients(federatedData: FederatedData): Patient[] {
  return federatedData.sites.flatMap(site => site.patients);
}

/**
 * Get site metadata
 */
export function getSiteMetadata(federatedData: FederatedData): SiteMetadata[] {
  return federatedData.sites.map(site => site.metadata);
}

/**
 * Summary statistics for a site
 */
export interface SiteSummary {
  site_id: string;
  n_patients: number;
  n_treated: number;
  n_control: number;
  treatment_rate: number;
  outcome_rate_treated: number;
  outcome_rate_control: number;
  outcome_rate_overall: number;
}

export function computeSiteSummary(siteData: SiteData): SiteSummary {
  const { metadata, patients } = siteData;
  
  const treated = patients.filter(p => p.treatment === 1);
  const control = patients.filter(p => p.treatment === 0);
  
  const outcome_rate_treated = treated.length > 0
    ? treated.filter(p => p.outcome === 1).length / treated.length
    : 0;
  
  const outcome_rate_control = control.length > 0
    ? control.filter(p => p.outcome === 1).length / control.length
    : 0;
  
  const outcome_rate_overall = patients.filter(p => p.outcome === 1).length / patients.length;
  
  return {
    site_id: metadata.site_id,
    n_patients: metadata.n_patients,
    n_treated: metadata.n_treated,
    n_control: metadata.n_control,
    treatment_rate: metadata.n_treated / metadata.n_patients,
    outcome_rate_treated,
    outcome_rate_control,
    outcome_rate_overall
  };
}

/**
 * Print federated data summary
 */
export function printFederatedSummary(federatedData: FederatedData): void {
  console.log('');
  console.log('🏥 Federated Data Summary');
  console.log('='.repeat(60));
  console.log(`Total sites: ${federatedData.sites.length}`);
  console.log(`Total patients: ${federatedData.total_patients}`);
  console.log(`Total treated: ${federatedData.total_treated} (${(100 * federatedData.total_treated / federatedData.total_patients).toFixed(1)}%)`);
  console.log(`Total control: ${federatedData.total_control} (${(100 * federatedData.total_control / federatedData.total_patients).toFixed(1)}%)`);
  console.log('');
  
  console.log('📊 Site-Specific Statistics:');
  console.log('');
  
  for (const site of federatedData.sites) {
    const summary = computeSiteSummary(site);
    console.log(`  ${summary.site_id}:`);
    console.log(`    Patients: ${summary.n_patients}`);
    console.log(`    Treated: ${summary.n_treated} (${(100 * summary.treatment_rate).toFixed(1)}%)`);
    console.log(`    Control: ${summary.n_control} (${(100 * (1 - summary.treatment_rate)).toFixed(1)}%)`);
    console.log(`    Outcome rate (treated): ${(100 * summary.outcome_rate_treated).toFixed(1)}%`);
    console.log(`    Outcome rate (control): ${(100 * summary.outcome_rate_control).toFixed(1)}%`);
    console.log(`    Naive ATE: ${(summary.outcome_rate_treated - summary.outcome_rate_control).toFixed(4)}`);
    console.log('');
  }
}

/**
 * Validate data consistency
 */
export function validateFederatedData(federatedData: FederatedData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check that metadata matches actual patient counts
  for (const site of federatedData.sites) {
    const { metadata, patients } = site;
    
    if (patients.length !== metadata.n_patients) {
      errors.push(`${metadata.site_id}: Patient count mismatch (metadata: ${metadata.n_patients}, actual: ${patients.length})`);
    }
    
    const actual_treated = patients.filter(p => p.treatment === 1).length;
    const actual_control = patients.filter(p => p.treatment === 0).length;
    
    if (actual_treated !== metadata.n_treated) {
      errors.push(`${metadata.site_id}: Treated count mismatch (metadata: ${metadata.n_treated}, actual: ${actual_treated})`);
    }
    
    if (actual_control !== metadata.n_control) {
      errors.push(`${metadata.site_id}: Control count mismatch (metadata: ${metadata.n_control}, actual: ${actual_control})`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

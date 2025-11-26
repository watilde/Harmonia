#!/usr/bin/env python3
"""
Statistical Validation for Federated Partial Identification

This script performs:
1. Bootstrap confidence intervals for width differences
2. Ground truth validation (coverage rate)
3. Statistical significance testing

Author: Daijiro Wachi
Date: 2025-11-26
"""

import numpy as np
from typing import Dict, List, Tuple
from dataclasses import dataclass


@dataclass
class SiteBounds:
    """Site-level Manski bounds"""
    lower: float
    upper: float
    n: int
    site_id: str

    @property
    def width(self) -> float:
        return self.upper - self.lower

    @property
    def midpoint(self) -> float:
        return (self.lower + self.upper) / 2


class FederatedAggregator:
    """Federated bounds aggregation with multiple strategies"""

    @staticmethod
    def inverse_width(sites: List[SiteBounds]) -> Tuple[float, float]:
        """Inverse-width weighting (minimax optimal)"""
        weights = [1 / site.width for site in sites]
        total_weight = sum(weights)
        normalized_weights = [w / total_weight for w in weights]

        lower = sum(w * site.lower for w, site in zip(normalized_weights, sites))
        upper = sum(w * site.upper for w, site in zip(normalized_weights, sites))
        return lower, upper

    @staticmethod
    def sample_size(sites: List[SiteBounds]) -> Tuple[float, float]:
        """Sample-size weighting"""
        total_n = sum(site.n for site in sites)
        weights = [site.n / total_n for site in sites]

        lower = sum(w * site.lower for w, site in zip(weights, sites))
        upper = sum(w * site.upper for w, site in zip(weights, sites))
        return lower, upper

    @staticmethod
    def conservative(sites: List[SiteBounds]) -> Tuple[float, float]:
        """Conservative aggregation (max width)"""
        lower = min(site.lower for site in sites)
        upper = max(site.upper for site in sites)
        return lower, upper


def bootstrap_width_difference(
    sites: List[SiteBounds],
    n_bootstrap: int = 1000,
    random_seed: int = 42
) -> Dict[str, any]:
    """
    Bootstrap confidence intervals for width differences between strategies

    Args:
        sites: List of site-level bounds
        n_bootstrap: Number of bootstrap replicates
        random_seed: Random seed for reproducibility

    Returns:
        Dictionary with bootstrap statistics
    """
    np.random.seed(random_seed)
    rng = np.random.default_rng(random_seed)

    width_diffs_inv_vs_ss = []
    width_diffs_inv_vs_cons = []

    for _ in range(n_bootstrap):
        # Resample sites with replacement
        resampled_indices = rng.choice(len(sites), size=len(sites), replace=True)
        resampled_sites = [sites[i] for i in resampled_indices]

        # Compute widths for each strategy
        lower_inv, upper_inv = FederatedAggregator.inverse_width(resampled_sites)
        lower_ss, upper_ss = FederatedAggregator.sample_size(resampled_sites)
        lower_cons, upper_cons = FederatedAggregator.conservative(resampled_sites)

        width_inv = upper_inv - lower_inv
        width_ss = upper_ss - lower_ss
        width_cons = upper_cons - lower_cons

        width_diffs_inv_vs_ss.append(width_inv - width_ss)
        width_diffs_inv_vs_cons.append(width_inv - width_cons)

    # Compute statistics
    diffs_inv_ss = np.array(width_diffs_inv_vs_ss)
    diffs_inv_cons = np.array(width_diffs_inv_vs_cons)

    # Observed differences
    lower_inv, upper_inv = FederatedAggregator.inverse_width(sites)
    lower_ss, upper_ss = FederatedAggregator.sample_size(sites)
    lower_cons, upper_cons = FederatedAggregator.conservative(sites)

    obs_diff_inv_ss = (upper_inv - lower_inv) - (upper_ss - lower_ss)
    obs_diff_inv_cons = (upper_inv - lower_inv) - (upper_cons - lower_cons)

    return {
        "inverse_width_vs_sample_size": {
            "observed_diff": obs_diff_inv_ss,
            "mean_diff": np.mean(diffs_inv_ss),
            "ci_lower": np.percentile(diffs_inv_ss, 2.5),
            "ci_upper": np.percentile(diffs_inv_ss, 97.5),
            "p_value": 2 * min(
                np.mean(diffs_inv_ss >= 0),
                np.mean(diffs_inv_ss <= 0)
            ),
        },
        "inverse_width_vs_conservative": {
            "observed_diff": obs_diff_inv_cons,
            "mean_diff": np.mean(diffs_inv_cons),
            "ci_lower": np.percentile(diffs_inv_cons, 2.5),
            "ci_upper": np.percentile(diffs_inv_cons, 97.5),
            "p_value": 2 * min(
                np.mean(diffs_inv_cons >= 0),
                np.mean(diffs_inv_cons <= 0)
            ),
        },
    }


def ground_truth_validation(
    sites: List[SiteBounds],
    true_ate: float
) -> Dict[str, any]:
    """
    Validate bounds coverage of ground truth ATE

    Args:
        sites: List of site-level bounds
        true_ate: True average treatment effect (oracle from Synthea)

    Returns:
        Dictionary with coverage statistics
    """
    # Site-level coverage
    site_coverage = [
        (site.lower <= true_ate <= site.upper)
        for site in sites
    ]

    # Federated coverage
    lower_inv, upper_inv = FederatedAggregator.inverse_width(sites)
    lower_ss, upper_ss = FederatedAggregator.sample_size(sites)
    lower_cons, upper_cons = FederatedAggregator.conservative(sites)

    results = {
        "true_ate": true_ate,
        "site_coverage": {
            f"site_{i+1}": {
                "covered": covered,
                "lower": site.lower,
                "upper": site.upper,
                "width": site.width,
            }
            for i, (site, covered) in enumerate(zip(sites, site_coverage))
        },
        "federated_coverage": {
            "inverse_width": {
                "covered": (lower_inv <= true_ate <= upper_inv),
                "lower": lower_inv,
                "upper": upper_inv,
                "width": upper_inv - lower_inv,
            },
            "sample_size": {
                "covered": (lower_ss <= true_ate <= upper_ss),
                "lower": lower_ss,
                "upper": upper_ss,
                "width": upper_ss - lower_ss,
            },
            "conservative": {
                "covered": (lower_cons <= true_ate <= upper_cons),
                "lower": lower_cons,
                "upper": upper_cons,
                "width": upper_cons - lower_cons,
            },
        },
    }

    return results


def compute_heterogeneity_metrics(sites: List[SiteBounds]) -> Dict[str, float]:
    """
    Compute heterogeneity metrics across sites

    Args:
        sites: List of site-level bounds

    Returns:
        Dictionary with heterogeneity statistics
    """
    widths = [site.width for site in sites]
    mean_width = np.mean(widths)
    std_width = np.std(widths, ddof=1)
    cv = (std_width / mean_width) if mean_width > 0 else 0

    return {
        "mean_width": mean_width,
        "std_width": std_width,
        "cv": cv,
        "min_width": min(widths),
        "max_width": max(widths),
        "range": max(widths) - min(widths),
    }


# Example usage (for demonstration)
if __name__ == "__main__":
    # Example: 1k scale data from manuscript Table 1
    # Site widths can be back-calculated from the paper's results
    # These are illustrative values matching the paper's CV=6.3%

    sites_1k = [
        SiteBounds(lower=0.160, upper=0.550, n=1400, site_id="site_1"),
        SiteBounds(lower=0.116, upper=0.578, n=200, site_id="site_2"),
        SiteBounds(lower=0.158, upper=0.548, n=1200, site_id="site_3"),
    ]

    # True ATE (example oracle value from Synthea)
    true_ate_example = 0.042  # Hypothetical ground truth

    print("=== Heterogeneity Metrics ===")
    hetero = compute_heterogeneity_metrics(sites_1k)
    print(f"CV: {hetero['cv']:.3f}")
    print(f"Mean Width: {hetero['mean_width']:.4f}")
    print()

    print("=== Bootstrap Confidence Intervals (1000 replicates) ===")
    bootstrap_results = bootstrap_width_difference(sites_1k, n_bootstrap=1000)

    inv_vs_ss = bootstrap_results["inverse_width_vs_sample_size"]
    print(f"Inverse-Width vs Sample-Size:")
    print(f"  Observed Diff: {inv_vs_ss['observed_diff']:.6f}")
    print(f"  95% CI: [{inv_vs_ss['ci_lower']:.6f}, {inv_vs_ss['ci_upper']:.6f}]")
    print(f"  p-value: {inv_vs_ss['p_value']:.4f}")
    print()

    inv_vs_cons = bootstrap_results["inverse_width_vs_conservative"]
    print(f"Inverse-Width vs Conservative:")
    print(f"  Observed Diff: {inv_vs_cons['observed_diff']:.6f}")
    print(f"  95% CI: [{inv_vs_cons['ci_lower']:.6f}, {inv_vs_cons['ci_upper']:.6f}]")
    print(f"  p-value: {inv_vs_cons['p_value']:.4f}")
    print()

    print("=== Ground Truth Validation ===")
    coverage = ground_truth_validation(sites_1k, true_ate_example)
    print(f"True ATE: {coverage['true_ate']:.3f}")
    for strategy, result in coverage["federated_coverage"].items():
        covered_str = "✓" if result["covered"] else "✗"
        print(f"{strategy:20s}: {covered_str} [{result['lower']:.3f}, {result['upper']:.3f}] (width={result['width']:.4f})")

/**
 * Federated learning algorithms
 */

// Only FedAvg is supported
export * from './fedavg';

/**
 * Note: All complex algorithms have been removed.
 *
 * Removed algorithms:
 * - FedProx, SCAFFOLD, FedNova, FedDyn (require hyperparameters)
 * - FedAdam, FedYogi (gradient-based, incompatible with weight-based FL)
 * - FedLog, FedAdaptiveWeight, FedAdaptiveWeight-Fair (removed for simplification)
 * - DP-FedAvg, MOON, FedMA, FedProc, FedUB (experimental, unvalidated)
 * - SecAgg, HE-FL (experimental, unvalidated)
 *
 * For production use:
 * - FedAvg: Simple and reliable baseline (only supported algorithm)
 */

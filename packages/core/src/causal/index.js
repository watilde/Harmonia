"use strict";
/**
 * Causal Inference Module
 *
 * Implements federated partial identification for privacy-preserving
 * causal inference in multi-site studies.
 *
 * Key Features:
 * - Partial identification bounds (Manski framework)
 * - Federated aggregation without data sharing
 * - Multiple aggregation strategies
 * - Support for various identifying assumptions (MTR, MTS)
 * - E-value sensitivity analysis
 * - Automatic assumption diagnostics
 * - Adaptive inference mode selection
 *
 * @example
 * ```typescript
 * import { computeATEBounds, federateATEBounds } from '@harmonia/core/causal';
 *
 * // Compute local bounds at each site
 * const site1Bounds = computeATEBounds(site1Data, { assumption: 'mtr' });
 * const site2Bounds = computeATEBounds(site2Data, { assumption: 'mtr' });
 *
 * // Aggregate bounds federally
 * const federated = federateATEBounds(
 *   [
 *     { ...site1Bounds, siteId: 'hospital-1' },
 *     { ...site2Bounds, siteId: 'hospital-2' }
 *   ],
 *   { strategy: 'weighted-average' }
 * );
 *
 * console.log(`Federated ATE ∈ [${federated.lower}, ${federated.upper}]`);
 * ```
 *
 * @module causal
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./partial-id"), exports);
__exportStar(require("./federated-agg"), exports);
__exportStar(require("./omop-synthetic"), exports);
__exportStar(require("./omop-extractor"), exports);
__exportStar(require("./evalue"), exports);
__exportStar(require("./assumption-diagnostics"), exports);
__exportStar(require("./inference-mode"), exports);
__exportStar(require("./robustness-index"), exports);
//# sourceMappingURL=index.js.map
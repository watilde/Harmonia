/**
 * Causal inference commands
 */

import { Command } from 'commander';
import { generateDataCommand } from './generate-data';
import { computeBoundsCommand } from './compute-bounds';
import { federateBoundsCommand } from './federate-bounds';
import { generateOMOPDataCommand } from './generate-omop-data';
import { runPolypharmacyCommand } from './run-polypharmacy';
import { computeEvalueCommand } from './compute-evalue';
import { computeFRICommand } from './compute-fri';
import { diagnoseAssumptionsCommand } from './diagnose-assumptions';
import { diagnoseAssumptionsParallelCommand } from './diagnose-assumptions-parallel';
import { benchmarkDiagnosticsCommand } from './benchmark-diagnostics';
import { selectInferenceModeCommand } from './select-inference-mode';

export const causalCommand = new Command('causal')
  .description('Federated causal inference with partial identification')
  .addCommand(generateDataCommand)
  .addCommand(computeBoundsCommand)
  .addCommand(federateBoundsCommand)
  .addCommand(generateOMOPDataCommand)
  .addCommand(runPolypharmacyCommand)
  .addCommand(computeEvalueCommand)
  .addCommand(computeFRICommand)
  .addCommand(diagnoseAssumptionsCommand)
  .addCommand(diagnoseAssumptionsParallelCommand)
  .addCommand(benchmarkDiagnosticsCommand)
  .addCommand(selectInferenceModeCommand);

export {
  generateDataCommand,
  computeBoundsCommand,
  federateBoundsCommand,
  generateOMOPDataCommand,
  runPolypharmacyCommand,
  computeEvalueCommand,
  computeFRICommand,
  diagnoseAssumptionsCommand,
  diagnoseAssumptionsParallelCommand,
  benchmarkDiagnosticsCommand,
  selectInferenceModeCommand,
};

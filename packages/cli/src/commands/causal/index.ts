/**
 * Causal inference commands
 */

import { Command } from 'commander';
import { generateDataCommand } from './generate-data';
import { computeBoundsCommand } from './compute-bounds';
import { federateBoundsCommand } from './federate-bounds';
import { generateOMOPDataCommand } from './generate-omop-data';
import { computeEvalueCommand } from './compute-evalue';
import { computeFRICommand } from './compute-fri';
import { diagnoseAssumptionsCommand } from './diagnose-assumptions';
import { selectInferenceModeCommand } from './select-inference-mode';

export const causalCommand = new Command('causal')
  .description('Federated causal inference with partial identification')
  .addCommand(generateDataCommand)
  .addCommand(computeBoundsCommand)
  .addCommand(federateBoundsCommand)
  .addCommand(generateOMOPDataCommand)
  .addCommand(computeEvalueCommand)
  .addCommand(computeFRICommand)
  .addCommand(diagnoseAssumptionsCommand)
  .addCommand(selectInferenceModeCommand);

export {
  generateDataCommand,
  computeBoundsCommand,
  federateBoundsCommand,
  generateOMOPDataCommand,
  computeEvalueCommand,
  computeFRICommand,
  diagnoseAssumptionsCommand,
  selectInferenceModeCommand,
};

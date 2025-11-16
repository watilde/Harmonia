/**
 * Causal inference commands
 */

import { Command } from 'commander';
import { generateDataCommand } from './generate-data';
import { computeBoundsCommand } from './compute-bounds';
import { federateBoundsCommand } from './federate-bounds';
import { generateOMOPDataCommand } from './generate-omop-data';

export const causalCommand = new Command('causal')
  .description('Causal inference with partial identification')
  .addCommand(generateDataCommand)
  .addCommand(computeBoundsCommand)
  .addCommand(federateBoundsCommand)
  .addCommand(generateOMOPDataCommand);

export {
  generateDataCommand,
  computeBoundsCommand,
  federateBoundsCommand,
  generateOMOPDataCommand,
};

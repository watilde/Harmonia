/**
 * Structured logging utility for CLI
 * Replaces scattered console.log/error calls with consistent logging
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';

export class Logger {
  /**
   * Log informational message
   */
  static info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  /**
   * Log success message
   */
  static success(message: string): void {
    console.log(chalk.green(''), message);
  }

  /**
   * Log error message
   */
  static error(message: string, error?: Error): void {
    console.error(chalk.red(' Error:'), message);
    if (error) {
      console.error(chalk.red('  Details:'), error.message);
      if (error.stack && process.env.DEBUG) {
        console.error(chalk.gray(error.stack));
      }
    }
  }

  /**
   * Log warning message
   */
  static warn(message: string): void {
    console.log(chalk.yellow('  Warning:'), message);
  }

  /**
   * Log debug message (only in debug mode)
   */
  static debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(chalk.gray('🐛 Debug:'), message);
    }
  }

  /**
   * Create a spinner for long-running operations
   */
  static spinner(message: string): Ora {
    return ora(message).start();
  }

  /**
   * Log a section header
   */
  static header(message: string): void {
    console.log(chalk.blue.bold(`\n${message}\n`));
  }

  /**
   * Log a key-value pair
   */
  static keyValue(key: string, value: string): void {
    console.log(`  ${key}: ${chalk.cyan(value)}`);
  }

  /**
   * Log a list of next steps
   */
  static nextSteps(steps: string[]): void {
    console.log(chalk.yellow('\n📋 Next steps:\n'));
    steps.forEach((step, index) => {
      console.log(`  ${index + 1}. ${chalk.bold(step)}`);
    });
    console.log();
  }

  /**
   * Log documentation links
   */
  static docs(links: Record<string, string>): void {
    console.log(chalk.blue('\n📖 Documentation:\n'));
    Object.entries(links).forEach(([title, url]) => {
      console.log(`  • ${title}: ${chalk.cyan(url)}`);
    });
    console.log();
  }
}

/**
 * Hashing utilities
 */

import * as crypto from 'crypto';

import { HashingOptions } from '../types';

/**
 * Hash data using SHA-256
 */
export function hash(data: Buffer, options: HashingOptions = {}): string {
  const algorithm = options.algorithm || 'SHA-256';
  const encoding = options.encoding || 'hex';

  const hasher = crypto.createHash(algorithm.toLowerCase().replace('-', ''));
  hasher.update(data);

  return encoding === 'hex' ? hasher.digest('hex') : hasher.digest('base64');
}

/**
 * Hash string data
 */
export function hashString(data: string, options?: HashingOptions): string {
  return hash(Buffer.from(data, 'utf-8'), options);
}

/**
 * Hash JSON object
 */
export function hashObject<T>(obj: T, options?: HashingOptions): string {
  const json = JSON.stringify(obj);
  return hashString(json, options);
}

/**
 * Verify hash matches data
 */
export function verifyHash(data: Buffer, expectedHash: string, options?: HashingOptions): boolean {
  const actualHash = hash(data, options);
  return actualHash === expectedHash;
}

/**
 * Generate random salt
 */
export function generateSalt(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash with salt (HMAC)
 */
export function hashWithSalt(data: Buffer, salt: string, options: HashingOptions = {}): string {
  const algorithm = options.algorithm || 'SHA-256';
  const encoding = options.encoding || 'hex';

  const hmac = crypto.createHmac(algorithm.toLowerCase().replace('-', ''), salt);
  hmac.update(data);

  return encoding === 'hex' ? hmac.digest('hex') : hmac.digest('base64');
}

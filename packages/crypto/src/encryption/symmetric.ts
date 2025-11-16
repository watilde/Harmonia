/**
 * Symmetric encryption using AES-256-GCM
 */

import * as crypto from 'crypto';

import { EncryptedData, EncryptionOptions } from '../types';

const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Generate a random encryption key
 */
export function generateKey(length: 128 | 256 = 256): Buffer {
  return crypto.randomBytes(length / 8);
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(data: Buffer, key: Buffer, options: EncryptionOptions = {}): EncryptedData {
  const algorithm = options.algorithm || 'AES-256-GCM';
  const cipherAlgorithm = algorithm.toLowerCase().replace(/-/g, '-');

  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(cipherAlgorithm, key, iv) as crypto.CipherGCM;

  // Encrypt data
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

  // Get auth tag for GCM mode
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    algorithm,
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(encryptedData: EncryptedData, key: Buffer): Buffer {
  const cipherAlgorithm = encryptedData.algorithm.toLowerCase().replace(/-/g, '-');

  // Decode base64 strings
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
  const authTag = encryptedData.authTag
    ? Buffer.from(encryptedData.authTag, 'base64')
    : Buffer.alloc(0);

  // Create decipher
  const decipher = crypto.createDecipheriv(cipherAlgorithm, key, iv) as crypto.DecipherGCM;

  // Set auth tag for GCM mode
  if (authTag.length > 0) {
    decipher.setAuthTag(authTag);
  }

  // Decrypt data
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Encrypt JSON-serializable object
 */
export function encryptObject<T>(obj: T, key: Buffer, options?: EncryptionOptions): EncryptedData {
  const json = JSON.stringify(obj);
  const buffer = Buffer.from(json, 'utf-8');
  return encrypt(buffer, key, options);
}

/**
 * Decrypt to JSON object
 */
export function decryptObject<T>(encryptedData: EncryptedData, key: Buffer): T {
  const buffer = decrypt(encryptedData, key);
  const json = buffer.toString('utf-8');
  return JSON.parse(json) as T;
}

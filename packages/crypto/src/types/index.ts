/**
 * Cryptographic type definitions
 */

/**
 * Encrypted data container
 */
export interface EncryptedData {
  ciphertext: string; // Base64 encoded
  iv: string; // Initialization vector, Base64 encoded
  authTag?: string; // Authentication tag for GCM mode, Base64 encoded
  algorithm: string; // e.g., "AES-256-GCM"
}

/**
 * Key pair for asymmetric encryption
 */
export interface KeyPair {
  publicKey: string; // PEM format
  privateKey: string; // PEM format
}

/**
 * Encryption options
 */
export interface EncryptionOptions {
  algorithm?: 'AES-256-GCM' | 'AES-256-CBC';
  keyLength?: 256 | 128;
}

/**
 * Hashing options
 */
export interface HashingOptions {
  algorithm?: 'SHA-256' | 'SHA-512';
  encoding?: 'hex' | 'base64';
}

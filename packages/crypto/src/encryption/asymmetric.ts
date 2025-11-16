/**
 * Asymmetric encryption using RSA
 */

import * as crypto from 'crypto';

import { KeyPair } from '../types';

/**
 * Generate RSA key pair
 */
export function generateKeyPair(keySize: 2048 | 4096 = 2048): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: keySize,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { publicKey, privateKey };
}

/**
 * Encrypt data with RSA public key
 */
export function encryptWithPublicKey(data: Buffer, publicKey: string): Buffer {
  return crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    data
  );
}

/**
 * Decrypt data with RSA private key
 */
export function decryptWithPrivateKey(encryptedData: Buffer, privateKey: string): Buffer {
  return crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    encryptedData
  );
}

/**
 * Hybrid encryption: RSA for key exchange, AES for data
 * Encrypts a symmetric key with RSA public key
 */
export function encryptSymmetricKey(symmetricKey: Buffer, publicKey: string): string {
  const encrypted = encryptWithPublicKey(symmetricKey, publicKey);
  return encrypted.toString('base64');
}

/**
 * Decrypt symmetric key with RSA private key
 */
export function decryptSymmetricKey(encryptedKey: string, privateKey: string): Buffer {
  const encrypted = Buffer.from(encryptedKey, 'base64');
  return decryptWithPrivateKey(encrypted, privateKey);
}

/**
 * Tests for Encryption Functions
 */

import {
  decryptObject,
  decryptSymmetricKey,
  encryptObject,
  encryptSymmetricKey,
  generateKey,
  generateKeyPair,
} from './index';

describe('Symmetric Encryption', () => {
  describe('generateKey', () => {
    it('should generate a 256-bit key', () => {
      const key = generateKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32); // 256 bits = 32 bytes
    });

    it('should generate unique keys', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('encryptObject and decryptObject', () => {
    it('should encrypt and decrypt data correctly', () => {
      const key = generateKey();
      const plaintext = { message: 'Hello, Federated Learning!', value: 42 };

      const encrypted = encryptObject(plaintext, key);
      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');

      const decrypted = decryptObject(encrypted, key);
      expect(decrypted).toEqual(plaintext);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const key = generateKey();
      const plaintext = { data: 'test' };

      const encrypted1 = encryptObject(plaintext, key);
      const encrypted2 = encryptObject(plaintext, key);

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should fail decryption with wrong key', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      const plaintext = { data: 'secret' };

      const encrypted = encryptObject(plaintext, key1);
      expect(() => decryptObject(encrypted, key2)).toThrow();
    });

    it('should fail decryption with tampered ciphertext', () => {
      const key = generateKey();
      const plaintext = { data: 'secret' };

      const encrypted = encryptObject(plaintext, key);

      // Tamper with ciphertext
      const tamperedCiphertext = encrypted.ciphertext.slice(0, -1) + 'X';
      const tampered = { ...encrypted, ciphertext: tamperedCiphertext };

      expect(() => decryptObject(tampered, key)).toThrow();
    });
  });
});

describe('Asymmetric Encryption', () => {
  describe('generateKeyPair', () => {
    it('should generate RSA key pair', () => {
      const { publicKey, privateKey } = generateKeyPair();
      expect(typeof publicKey).toBe('string');
      expect(typeof privateKey).toBe('string');
      expect(publicKey).toContain('BEGIN PUBLIC KEY');
      expect(privateKey).toContain('BEGIN PRIVATE KEY');
    });
  });

  describe('encryptSymmetricKey and decryptSymmetricKey', () => {
    it('should encrypt and decrypt symmetric key', () => {
      const { publicKey, privateKey } = generateKeyPair();
      const symmetricKey = generateKey();

      const encrypted = encryptSymmetricKey(symmetricKey, publicKey);
      expect(typeof encrypted).toBe('string');

      const decrypted = decryptSymmetricKey(encrypted, privateKey);
      expect(decrypted.equals(symmetricKey)).toBe(true);
    });

    it('should fail decryption with wrong private key', () => {
      const keyPair1 = generateKeyPair();
      const keyPair2 = generateKeyPair();
      const symmetricKey = generateKey();

      const encrypted = encryptSymmetricKey(symmetricKey, keyPair1.publicKey);
      expect(() => decryptSymmetricKey(encrypted, keyPair2.privateKey)).toThrow();
    });
  });
});

describe('Hybrid Encryption', () => {
  it('should encrypt large data with hybrid encryption', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const symmetricKey = generateKey();

    // Encrypt symmetric key with RSA
    const encryptedKey = encryptSymmetricKey(symmetricKey, publicKey);

    // Encrypt large data with AES
    const largeData = {
      weights: Array(1000)
        .fill(0)
        .map((_, i) => i * 0.1),
      metadata: { round: 5, sampleCount: 10000 },
    };
    const encryptedData = encryptObject(largeData, symmetricKey);

    // Decrypt symmetric key with RSA
    const decryptedKey = decryptSymmetricKey(encryptedKey, privateKey);

    // Decrypt data with AES
    const decryptedData = decryptObject(encryptedData, decryptedKey);

    expect(decryptedData).toEqual(largeData);
  });

  it('should handle multiple clients with different key pairs', () => {
    const coordinator = generateKeyPair();

    // Client 1 encrypts data
    const client1Key = generateKey();
    const client1Data = { siteId: 'site1', value: 100 };
    const client1EncryptedKey = encryptSymmetricKey(client1Key, coordinator.publicKey);
    const client1EncryptedData = encryptObject(client1Data, client1Key);

    // Client 2 encrypts data
    const client2Key = generateKey();
    const client2Data = { siteId: 'site2', value: 200 };
    const client2EncryptedKey = encryptSymmetricKey(client2Key, coordinator.publicKey);
    const client2EncryptedData = encryptObject(client2Data, client2Key);

    // Coordinator decrypts both
    const decryptedKey1 = decryptSymmetricKey(client1EncryptedKey, coordinator.privateKey);
    const decryptedData1 = decryptObject(client1EncryptedData, decryptedKey1);
    expect(decryptedData1).toEqual(client1Data);

    const decryptedKey2 = decryptSymmetricKey(client2EncryptedKey, coordinator.privateKey);
    const decryptedData2 = decryptObject(client2EncryptedData, decryptedKey2);
    expect(decryptedData2).toEqual(client2Data);
  });
});

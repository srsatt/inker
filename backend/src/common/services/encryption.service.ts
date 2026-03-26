import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT = 'inker-plugin-settings';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const secret = config.get<string>('encryption.key') || config.get<string>('admin.pin') || 'inker-default-key';
    this.key = scryptSync(secret, SALT, KEY_LENGTH);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }
    const [ivB64, authTagB64, encryptedB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');

    const decipher = createDecipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  encryptObject(obj: Record<string, any>): Record<string, string> {
    const encrypted: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        encrypted[key] = this.encrypt(String(value));
      }
    }
    return encrypted;
  }

  decryptObject(obj: Record<string, any>): Record<string, string> {
    const decrypted: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      try {
        decrypted[key] = this.decrypt(String(value));
      } catch {
        this.logger.warn(`Failed to decrypt field "${key}"`);
        decrypted[key] = '';
      }
    }
    return decrypted;
  }
}

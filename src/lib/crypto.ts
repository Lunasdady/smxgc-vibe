/**
 * 敏感数据加密工具
 * 使用 AES-256-GCM 算法，需要环境变量 ENCRYPTION_KEY（至少32字符）
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const keyEnv = process.env.ENCRYPTION_KEY;
  if (!keyEnv) {
    throw new Error('ENCRYPTION_KEY 环境变量未设置，请在 .env 中配置（至少32字符）');
  }
  return crypto.scryptSync(keyEnv, 'smxgc-salt-v1', 32);
}

/**
 * 加密文本
 * 返回格式: iv:authTag:ciphertext (均为 hex)
 */
export function encrypt(text: string): string {
  if (!text) return text;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * 解密文本
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData || !encryptedData.includes(':')) return encryptedData;
  const key = getKey();
  const parts = encryptedData.split(':');
  if (parts.length !== 3) return encryptedData;
  const [ivHex, authTagHex, encryptedHex] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return decipher.update(encryptedHex, 'hex') + decipher.final('utf8');
}

/**
 * 判断字符串是否已加密（简单启发式检测）
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;
  const parts = text.split(':');
  return parts.length === 3 && parts.every(p => /^[a-f0-9]+$/.test(p) && p.length >= 32);
}

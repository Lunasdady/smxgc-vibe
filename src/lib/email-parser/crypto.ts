import CryptoJS from 'crypto-js';

const ENCRYPT_KEY = process.env.EMAIL_ENCRYPT_KEY || 'default-email-encrypt-key-2026';

/**
 * AES加密
 */
export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, ENCRYPT_KEY).toString();
}

/**
 * AES解密
 */
export function decrypt(cipherText: string): string {
  const bytes = CryptoJS.AES.decrypt(cipherText, ENCRYPT_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

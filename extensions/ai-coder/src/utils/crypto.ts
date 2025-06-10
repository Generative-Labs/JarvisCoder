import crypto from "crypto";

import { BASE64_KEY } from "../configs";

const key = Buffer.from(BASE64_KEY, "base64");

/**
 * Decrypts data that was encrypted with AES-256-GCM
 * @param {string} encryptedData - The encrypted data in base64 format
 * @returns {string} The decrypted data as a UTF-8 string
 * @throws {Error} If decryption fails
 */
export function decrypt(encryptedData: string): string {
  try {
    const buf = Buffer.from(encryptedData, "base64");
    // GCM mode requires 12 bytes of IV
    const iv = buf.slice(0, 12);
    // The last 16 bytes are the authentication tag
    const authTag = buf.slice(buf.length - 16);
    // The middle part is the ciphertext
    const ciphertext = buf.slice(12, buf.length - 16);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString("utf8");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown decryption error';
    throw new Error(`Decryption failed: ${errorMessage}`);
  }
}

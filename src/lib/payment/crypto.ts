import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Sanal POS API anahtarlari veritabaninda AES-256-GCM ile sifreli tutulur
// (bkz. IYZICO_SANAL_POS_PLANI.md bolum 3/4). Sifreleme anahtari env'de
// (PAYMENT_ENCRYPTION_KEY, base64, tam 32 bayt) durur, veritabaninda degil -
// boylece DB sizsa bile anahtarlar acik metin olmaz.
// Cikti bicimi: base64( iv[12] + authTag[16] + ciphertext ).

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function loadKey(rawKey: string | undefined): Buffer {
  if (!rawKey) {
    throw new Error("PAYMENT_ENCRYPTION_KEY tanımlı değil.");
  }
  const key = Buffer.from(rawKey.trim(), "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(`PAYMENT_ENCRYPTION_KEY base64 olarak tam ${KEY_LENGTH} bayt olmalı (şu an ${key.length}).`);
  }
  return key;
}

export function isEncryptionKeyConfigured(rawKey: string | undefined = process.env.PAYMENT_ENCRYPTION_KEY): boolean {
  try {
    loadKey(rawKey);
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plaintext: string, rawKey: string | undefined = process.env.PAYMENT_ENCRYPTION_KEY): string {
  const key = loadKey(rawKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

// Bozulmus/kurcalanmis veri veya yanlis anahtar durumunda GCM kimlik dogrulamasi
// basarisiz olur ve hata firlatilir - sessizce yanlis deger dondurulmez.
export function decryptSecret(payload: string, rawKey: string | undefined = process.env.PAYMENT_ENCRYPTION_KEY): string {
  const key = loadKey(rawKey);
  const data = Buffer.from(payload, "base64");
  if (data.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Şifreli veri geçersiz.");
  }
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

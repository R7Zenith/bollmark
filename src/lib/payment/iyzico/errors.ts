// iyzico hata kodlarinin Turkce kullanici mesajlarina eslemesi (bkz. plan 1.8).
// Ham iyzico hata metni kullaniciya gosterilmez.

const GENERIC_MESSAGE = "Ödeme tamamlanamadı. Lütfen tekrar deneyin ya da farklı bir kart kullanın.";
const BANK_REJECTED_MESSAGE = "Kartınız bankası tarafından reddedildi. Lütfen bankanızla görüşün.";

const messages: Record<string, string> = {
  "10051": "Kartınızın limiti veya bakiyesi yetersiz.",
  "10054": "Kartın son kullanma tarihi hatalı.",
  "10084": "Kartın güvenlik kodu (CVC) hatalı.",
  "10093": "Kartınız internet alışverişine kapalı. Bankanızla görüşebilirsiniz.",
  "10012": BANK_REJECTED_MESSAGE,
  "10005": BANK_REJECTED_MESSAGE,
  "10201": BANK_REJECTED_MESSAGE,
  "10220": BANK_REJECTED_MESSAGE,
  "10215": "Kart bilgileri geçersiz.",
  "10217": "Banka kartları yalnızca 3D Secure ile kullanılabilir.",
  "10218": "Banka kartıyla taksit yapılamaz.",
  "10221": "Yurt dışı kartlar şu an kabul edilmiyor.",
  "10034": "Güvenlik denetimi nedeniyle işlem tamamlanamadı. Lütfen farklı bir kart deneyin.",
  // Kayip/calinti kart: kullaniciya sebep aciklanmaz, genel mesaj verilir.
  "10041": GENERIC_MESSAGE,
  "10043": GENERIC_MESSAGE
};

// Yonetici panelindeki baglanti testi mesajlari (kullaniciya degil admin'e gosterilir).
const adminMessages: Record<string, string> = {
  "1000": "Anahtarlar geçersiz: imza doğrulanamadı (Secret Key yanlış olabilir).",
  "1001": "Anahtarlar geçersiz: API Key bulunamadı.",
  "1004": "İstek kimliği (rnd) eksik.",
  "1006": "API Key eksik.",
  "1007": "İmza eksik."
};

export function describePaymentError(errorCode: string | number | null | undefined): string {
  if (errorCode === null || errorCode === undefined) return GENERIC_MESSAGE;
  return messages[String(errorCode)] ?? GENERIC_MESSAGE;
}

export function describeAdminError(errorCode: string | number | null | undefined, rawMessage?: string | null): string {
  const code = errorCode === null || errorCode === undefined ? "" : String(errorCode);
  if (adminMessages[code]) return adminMessages[code];
  if (messages[code]) return messages[code];
  return `iyzico hatası${code ? ` ${code}` : ""}${rawMessage ? `: ${rawMessage}` : ""}`.slice(0, 300);
}

import { sendMail } from "@/lib/mail";
import { contactPrefLabel, type ContactPref } from "@/lib/status";

// /iletisim formundan gelen mesajlarin dusecegi gelen kutusu.
const CONTACT_INBOX = "bilgi@bollmark.com";

// Kullanici girdisi mail HTML'ine girmeden once kacislanir (order-notifications.ts
// ile ayni "ic bildirim" tonu ama burada girdi tamamen dis kaynakli).
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function notifyContactMessage(message: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  contactPrefs: string[];
  message: string;
}): Promise<void> {
  const fullName = `${message.firstName} ${message.lastName}`.replace(/\s+/g, " ").trim();
  const prefs =
    message.contactPrefs.map((p) => contactPrefLabel[p as ContactPref] ?? p).join(", ") || "Belirtilmedi";

  await sendMail({
    to: CONTACT_INBOX,
    replyTo: message.email,
    subject: `Yeni iletişim formu mesajı - ${fullName}`,
    html: `<p><strong>Ad Soyad:</strong> ${escapeHtml(fullName)}</p>
           <p><strong>E-posta:</strong> ${escapeHtml(message.email)}</p>
           <p><strong>Telefon:</strong> ${message.phone ? escapeHtml(message.phone) : "-"}</p>
           <p><strong>İletişim tercihi:</strong> ${escapeHtml(prefs)}</p>
           <p><strong>Mesaj:</strong></p>
           <p style="white-space:pre-wrap">${escapeHtml(message.message)}</p>
           <p><a href="https://bollmark.com/admin/mesajlar/${message.id}">Admin panelde görüntüle</a></p>`
  });
}

// loyalty.ts'den ayri tutulur cunku o dosya prisma'yi (dolayisiyla Neon
// driver'ini) import ediyor - client bilesenlerinde (checkout puan alani)
// sadece bu sabitler gerekiyor, prisma'nin client bundle'a sizmasini
// engellemek icin (bkz. audit-actions.ts'deki ayni gerekce).
export const LOYALTY_EARN_RATE = 0.01; // 100 TL harcama = 1 puan
export const LOYALTY_REDEEM_RATE_CENTS = 10; // 1 puan = 10 kurus indirim

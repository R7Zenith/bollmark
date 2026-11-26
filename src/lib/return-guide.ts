import { RETURN_INFO, STORE_INFO } from "@/lib/store-info";
import { returnGuideStatuses, type ReturnStatus } from "@/lib/status";
import { returnGuideSteps, returnGuideWarning } from "@/lib/email/order-emails";

// "Urunu nasil gonderirim?" kutusunun verisi - yalniz sunucuda uretilir ve
// yalniz ONAYLANDI/KARGODA talepte doner (anlasma kodu herkese acik olmasin,
// IADE_TALEBI_SISTEMI_PLANI.md 3). Adim metinleri onay mailiyle ayni kaynaktan.
export type ReturnGuideData = {
  carrier: string;
  code: string;
  recipient: string;
  address: string;
  steps: string[];
  warning: string;
};

export function returnGuideFor(status: string, orderNumber: string): ReturnGuideData | null {
  if (!returnGuideStatuses.includes(status as ReturnStatus)) return null;
  return {
    carrier: STORE_INFO.returnCarrier,
    code: RETURN_INFO.returnCarrierCode,
    recipient: RETURN_INFO.returnRecipient,
    address: RETURN_INFO.returnAddress,
    steps: returnGuideSteps(orderNumber),
    warning: returnGuideWarning()
  };
}

import type { BadgeTone } from "@/components/admin/badge";

export const orderStatuses = [
  "PENDING_PAYMENT",
  "PAID",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED"
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const orderStatusLabel: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Ödeme Bekliyor",
  PAID: "Ödendi",
  PREPARING: "Hazırlanıyor",
  SHIPPED: "Kargolandı",
  DELIVERED: "Teslim Edildi",
  CANCELLED: "İptal",
  REFUNDED: "İade Edildi"
};

export const orderStatusTone: Record<OrderStatus, BadgeTone> = {
  PENDING_PAYMENT: "yellow",
  PAID: "green",
  PREPARING: "blue",
  SHIPPED: "blue",
  DELIVERED: "green",
  CANCELLED: "red",
  REFUNDED: "gray"
};

export const shipmentStatuses = [
  "HAZIRLANIYOR",
  "KARGOYA_VERILDI",
  "DAGITIMDA",
  "TESLIM_EDILDI",
  "IADE"
] as const;
export type ShipmentStatus = (typeof shipmentStatuses)[number];

export const shipmentStatusLabel: Record<ShipmentStatus, string> = {
  HAZIRLANIYOR: "Hazırlanıyor",
  KARGOYA_VERILDI: "Kargoya Verildi",
  DAGITIMDA: "Dağıtımda",
  TESLIM_EDILDI: "Teslim Edildi",
  IADE: "İade"
};

export const shipmentStatusTone: Record<ShipmentStatus, BadgeTone> = {
  HAZIRLANIYOR: "yellow",
  KARGOYA_VERILDI: "blue",
  DAGITIMDA: "blue",
  TESLIM_EDILDI: "green",
  IADE: "red"
};

export const returnStatuses = ["TALEP_EDILDI", "ONAYLANDI", "REDDEDILDI", "KARGODA", "TAMAMLANDI"] as const;
export type ReturnStatus = (typeof returnStatuses)[number];

export const returnStatusLabel: Record<ReturnStatus, string> = {
  TALEP_EDILDI: "Talep Edildi",
  ONAYLANDI: "Onaylandı",
  REDDEDILDI: "Reddedildi",
  KARGODA: "Kargoda",
  TAMAMLANDI: "Tamamlandı"
};

export const returnStatusTone: Record<ReturnStatus, BadgeTone> = {
  TALEP_EDILDI: "yellow",
  ONAYLANDI: "blue",
  REDDEDILDI: "red",
  KARGODA: "blue",
  TAMAMLANDI: "green"
};

// Durum degisikliginde musteriye mail atilan gecisler - notifyReturnStatusChange
// bunun disindaki durumlarda (TALEP_EDILDI, KARGODA) mail atmaz.
export const returnStatusNotifiable: ReturnStatus[] = ["ONAYLANDI", "REDDEDILDI", "TAMAMLANDI"];

export const returnTypes = ["IADE", "DEGISIM"] as const;
export type ReturnType = (typeof returnTypes)[number];

export const returnTypeLabel: Record<ReturnType, string> = {
  IADE: "İade",
  DEGISIM: "Değişim"
};

export const returnReasons = ["Beden uymadı", "Ürün hasarlı geldi", "Farklı ürün istiyorum", "Diğer"] as const;

import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { legalIdentityRows, phoneDisplay, STORE_INFO } from "@/lib/store-info";
import { DISPATCH_TEXT, SHIPPING_THRESHOLD_CENTS, shippingFeeSummary } from "@/lib/shipping";

// On Bilgilendirme Formu (6502 sayili Kanun m.48, Mesafeli Sozlesmeler
// Yonetmeligi m.5). Hem /on-bilgilendirme-formu (genel metin) hem odeme
// adimindaki pencere (order verilir, siparise ozel ozet eklenir) bu metni
// kullanir. Satici bilgileri (unvan, MERSIS, vergi, telefon, adres, e-posta)
// STORE_INFO'dan; null alanlar gosterilmez.

export const PRE_INFORMATION_UPDATED_AT = "26 Ekim 2026";

export type PreInformationOrder = {
  lines: { key: string; name: string; color: string; size: string; quantity: number; lineTotalCents: number }[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  buyer: { name: string; email: string; phone: string; address: string };
};

const h2Class = "mt-10 font-display text-xl text-ink";
const pClass = "mt-4 text-sm leading-relaxed text-ink/80";
const rowClass = "flex justify-between gap-4 py-1.5";

const { address } = STORE_INFO;
const sellerAddress = `${address.streetAddress} ${address.addressLocality}/${address.addressRegion}`;

function OrderSummary({ order }: { order: PreInformationOrder }) {
  const { buyer } = order;
  const missing = "Henüz girilmedi";
  return (
    <>
      <h2 className={h2Class}>Siparişinize Ait Bilgiler</h2>
      <div className="mt-4 text-sm text-ink/80">
        <p className="font-medium text-ink">Alıcı</p>
        <p className="mt-1 whitespace-pre-line leading-relaxed">
          {`Ad Soyad: ${buyer.name || missing}
E-posta: ${buyer.email || missing}
Telefon: ${buyer.phone || missing}
Teslimat adresi: ${buyer.address || missing}`}
        </p>

        <p className="mt-6 font-medium text-ink">Ürünler (KDV dahil)</p>
        <div className="mt-1 divide-y divide-line border-y border-line">
          {order.lines.map((line) => (
            <div key={line.key} className={rowClass}>
              <span>
                {line.name} ({line.color} · {line.size}) × {line.quantity}
              </span>
              <span className="shrink-0">{formatPrice(line.lineTotalCents)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <div className={rowClass}>
            <span>Ara Toplam</span>
            <span>{formatPrice(order.subtotalCents)}</span>
          </div>
          {order.discountCents > 0 && (
            <div className={rowClass}>
              <span>İndirimler</span>
              <span>-{formatPrice(order.discountCents)}</span>
            </div>
          )}
          <div className={rowClass}>
            <span>Kargo Ücreti</span>
            <span>{order.shippingCents === 0 ? "Ücretsiz" : formatPrice(order.shippingCents)}</span>
          </div>
          <div className={`${rowClass} font-medium text-ink`}>
            <span>Vergiler Dahil Toplam</span>
            <span>{formatPrice(order.totalCents)}</span>
          </div>
        </div>
      </div>
    </>
  );
}

export function PreInformationForm({
  standardShippingCents,
  order
}: {
  standardShippingCents: number;
  /** Odeme adiminda verilir: siparise ozel alici/urun/tutar ozeti eklenir. */
  order?: PreInformationOrder;
}) {
  return (
    <>
      <p className={pClass}>
        İşbu Ön Bilgilendirme Formu, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler
        Yönetmeliği uyarınca, bollmark.com (&quot;Site&quot;) üzerinden vereceğiniz siparişe ilişkin mesafeli satış
        sözleşmesi kurulmadan önce sizi bilgilendirmek amacıyla hazırlanmıştır.
      </p>

      <h2 className={h2Class}>1. Satıcı Bilgileri</h2>
      <div className={pClass}>
        {legalIdentityRows().map((row) => (
          <p key={row.label}>
            {row.label}: {row.value}
          </p>
        ))}
        <p>Adres: {sellerAddress}</p>
        {/* Numara yalniz WhatsApp icin (aramalar acilmaz) - duz metin. */}
        {STORE_INFO.phone && <p>Telefon / WhatsApp: {phoneDisplay(STORE_INFO.phone)}</p>}
        <p>E-posta: {STORE_INFO.email}</p>
      </div>

      {order && <OrderSummary order={order} />}

      <h2 className={h2Class}>2. Ürünün Temel Nitelikleri ve Fiyatı</h2>
      <p className={pClass}>
        Sipariş konusu ürünün cinsi, markası/modeli, rengi, bedeni, adedi ve vergiler dahil satış fiyatı, ürün sayfasında
        ve ödeme adımındaki sipariş özetinde gösterilir; bu bilgiler siparişi onayladığınız anda geçerli olan
        bilgilerdir. Tüm fiyatlara KDV dahildir. Kampanya, kupon veya puan indirimi uygulanmışsa indirim tutarı sipariş
        özetinde ayrıca gösterilir.
      </p>

      <h2 className={h2Class}>3. Teslimat Bilgileri ve Masrafları</h2>
      <p className={pClass}>
        {DISPATCH_TEXT} Teslimat, sipariş sırasında belirttiğiniz adrese anlaşmalı kargo firması aracılığıyla yapılır.
        Teslimat süresi, siparişin onaylanmasından itibaren hiçbir durumda yasal 30 günlük süreyi aşmaz. Resmi tatiller ve
        yoğun kampanya dönemlerinde teslimat süresi uzayabilir; böyle bir durumda tarafınıza bilgi verilir.
      </p>
      <p className={pClass}>
        {shippingFeeSummary(standardShippingCents)} Kargo ücreti, sipariş tutarı{" "}
        {formatPrice(SHIPPING_THRESHOLD_CENTS)} altında kaldığında sipariş toplamına eklenir ve ödeme adımında ayrıca
        gösterilir. Bunun dışında sizden ek bir teslimat masrafı talep edilmez.
      </p>

      <h2 className={h2Class}>4. Ödeme Bilgileri</h2>
      <p className={pClass}>
        Ödeme, iyzico güvenli ödeme altyapısı üzerinden kredi kartı veya banka kartı ile, 3D Secure doğrulamasıyla
        alınır. Kart bilgileriniz Site&apos;de saklanmaz. Ödemenin onaylanmasıyla sipariş kesinleşir ve sipariş onayı
        e-posta adresinize gönderilir.
      </p>

      <h2 className={h2Class}>5. Cayma Hakkı ve Kullanım Şekli</h2>
      <p className={pClass}>
        Hiçbir hukuki ve cezai sorumluluk üstlenmeksizin ve hiçbir gerekçe göstermeksizin, ürünün size veya
        gösterdiğiniz adresteki üçüncü kişiye tesliminden itibaren {STORE_INFO.returnDays} (on dört) gün içinde cayma
        hakkınızı kullanabilirsiniz. Birden fazla ürünün ayrı ayrı teslim edildiği siparişlerde süre, son ürünün
        tesliminden itibaren başlar.
      </p>
      <p className={pClass}>
        Cayma hakkınızı kullanmak için bu süre içinde {STORE_INFO.email} adresine sipariş numaranızla birlikte açık bir
        bildirim göndermeniz yeterlidir. Ürünü, cayma bildiriminden itibaren 10 gün içinde faturası, kutusu/ambalajı ve
        etiketleriyle birlikte, kullanılmamış ve hasarsız olarak {sellerAddress} adresine göndermeniz gerekir. İade kargo
        ücreti alıcıya aittir. Ürün bedeli, cayma bildiriminin bize ulaşmasından itibaren en geç 14 gün içinde ödemeyi
        yaptığınız yönteme iade edilir. Ayrıntılar için{" "}
        <Link href="/sayfa/iade-kosullari" className="text-ink underline underline-offset-2">
          İade Koşulları
        </Link>{" "}
        sayfasını inceleyebilirsiniz.
      </p>

      <h2 className={h2Class}>6. Cayma Hakkının İstisnaları</h2>
      <p className={pClass}>
        Mesafeli Sözleşmeler Yönetmeliği&apos;nin 15. maddesi uyarınca; teslimden sonra ambalajı, bandı, mührü veya
        etiketi açılmış olup iadesi sağlık ve hijyen açısından uygun olmayan ürünlerde (iç giyim, mayo, bikini gibi
        ürünler dahil) ve tüketicinin istekleri veya kişisel ihtiyaçları doğrultusunda hazırlanan ürünlerde cayma hakkı
        kullanılamaz. Bu ürünler, orijinal ambalajı açılmamış ve etiketi çıkarılmamış olması koşuluyla iade edilebilir.
      </p>

      <h2 className={h2Class}>7. Şikâyet ve İtiraz Başvuruları</h2>
      <p className={pClass}>
        Şikâyetlerinizi {STORE_INFO.email} adresine iletebilirsiniz. Uyuşmazlık halinde, Ticaret Bakanlığınca her yıl
        belirlenen parasal sınırlar dahilinde yerleşim yerinizdeki veya işlemin yapıldığı yerdeki Tüketici Hakem
        Heyeti&apos;ne, bu sınırları aşan uyuşmazlıklarda Tüketici Mahkemesi&apos;ne başvurabilirsiniz. Başvurular
        e-Devlet üzerinden Tüketici Bilgi Sistemi (TÜBİS) aracılığıyla da yapılabilir.
      </p>

      <h2 className={h2Class}>8. Diğer Hususlar</h2>
      <p className={pClass}>
        Siparişinizi vermeden önce işbu formu ve{" "}
        <Link href="/sayfa/mesafeli-satis-sozlesmesi" className="text-ink underline underline-offset-2">
          Mesafeli Satış Sözleşmesi
        </Link>
        &apos;ni ödeme adımında elektronik ortamda onaylarsınız. Kişisel verilerinizin işlenmesine ilişkin bilgiler{" "}
        <Link href="/sayfa/gizlilik-politikasi" className="text-ink underline underline-offset-2">
          Gizlilik Politikası ve Aydınlatma Metni
        </Link>
        &apos;nde yer alır.
      </p>

      <p className={pClass}>Son güncelleme: {PRE_INFORMATION_UPDATED_AT}</p>
    </>
  );
}

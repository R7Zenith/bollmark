// Yapisal veri (schema.org) script etiketi. "<" kacirilir ki veritabanindan
// gelen bir metin </script> ile etiketi kapatamasin (bkz. Next.js JSON-LD
// rehberi).
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\u003c") }}
    />
  );
}

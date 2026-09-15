"use client";

export function FooterNewsletterForm() {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        // TODO: gerçek bir bülten kayıt endpoint'ine bağla (henüz yok).
      }}
      className="mt-6 flex max-w-sm gap-2"
    >
      <label htmlFor="footer-newsletter-email" className="sr-only">
        E-posta adresiniz
      </label>
      <input
        id="footer-newsletter-email"
        type="email"
        required
        placeholder="E-posta adresiniz"
        className="w-full border border-cream/30 bg-transparent px-4 py-3 text-sm text-cream placeholder:text-cream/40 focus:border-cream focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 bg-cream px-5 py-3 text-sm uppercase tracking-widest2 text-ink hover:bg-clay hover:text-cream"
      >
        Abone Ol
      </button>
    </form>
  );
}

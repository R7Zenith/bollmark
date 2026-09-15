"use client";

export function FooterNewsletterForm() {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        // TODO: gerçek bir bülten kayıt endpoint'ine bağla (henüz yok).
      }}
      className="mt-4 flex max-w-sm items-stretch bg-cream"
    >
      <label htmlFor="footer-newsletter-email" className="sr-only">
        E-posta adresiniz
      </label>
      <input
        id="footer-newsletter-email"
        type="email"
        required
        placeholder="E-posta adresiniz"
        className="w-full bg-transparent px-4 py-2.5 text-sm text-ink placeholder:text-ink/50 focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 border-l border-ink/10 px-5 py-2.5 text-sm uppercase tracking-widest2 text-ink hover:bg-ink hover:text-cream"
      >
        Abone Ol
      </button>
    </form>
  );
}

import ChromeIcon from "./ChromeIcon";

const CHROME_STORE_URL = "https://chromewebstore.google.com/detail/traacky/gbanfpfljdeeililjkaejmljnckmoged";

export default function CTA() {
  return (
    <section className="section-divider relative py-28 sm:py-32 md:py-40">
      <div className="cta-glow" />
      <div className="relative z-10 mx-auto max-w-[700px] px-5 text-center sm:px-8">
        {/* Bold statement (neon.com-style) */}
        <h2 className="text-[2rem] font-extrabold tracking-[-0.03em] text-text sm:text-[2.5rem] md:text-[3.25rem] md:leading-[1.08]">
          The most advanced{" "}
          <span className="text-gradient">tracking inspector</span>{" "}
          for Chrome.
        </h2>
        <p className="mx-auto mt-5 max-w-[460px] text-[16px] leading-relaxed text-text-secondary">
          Join thousands of tracking professionals who save hours every week
          with Traacky.
        </p>
        <a
          href={CHROME_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-9 inline-flex items-center gap-2.5 rounded-xl px-8 py-3.5 text-[15px] font-semibold"
        >
          <ChromeIcon size={20} />
          Add to Chrome — Free
        </a>
      </div>
    </section>
  );
}

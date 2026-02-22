import ChromeIcon from "./ChromeIcon";

const CHROME_STORE_URL = "https://chromewebstore.google.com/detail/trackpulse/";

export default function CTA() {
  return (
    <section className="section-divider relative py-24 sm:py-28 md:py-32">
      <div className="cta-glow" />
      <div className="relative z-10 mx-auto max-w-[560px] px-5 text-center sm:px-8">
        <h2 className="text-[1.75rem] font-bold tracking-tight text-white sm:text-[2rem] md:text-[2.5rem]">
          Ready to stop guessing about your tracking?
        </h2>
        <p className="mx-auto mt-4 max-w-[440px] text-text-secondary">
          Join thousands of tracking professionals who save hours every week
          with TrackPulse.
        </p>
        <a
          href={CHROME_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-8 inline-flex items-center gap-2.5 rounded-xl px-8 py-3.5 text-[15px] font-semibold"
        >
          <ChromeIcon size={20} />
          Add to Chrome — Free
        </a>
      </div>
    </section>
  );
}

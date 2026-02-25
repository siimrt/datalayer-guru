"use client";

import ChromeIcon from "./ChromeIcon";

const CHROME_STORE_URL = "https://chromewebstore.google.com/detail/traacky/";

/* Aurora lines — thin vertical beams of varying brightness */
const LINES = [
  { left: "8%", w: 1, opacity: 0.06 },
  { left: "12%", w: 1.5, opacity: 0.10 },
  { left: "18%", w: 1, opacity: 0.04 },
  { left: "23%", w: 2, opacity: 0.14 },
  { left: "27%", w: 1, opacity: 0.06 },
  { left: "32%", w: 1.5, opacity: 0.18 },
  { left: "36%", w: 1, opacity: 0.08 },
  { left: "40%", w: 2, opacity: 0.22 },
  { left: "43%", w: 1, opacity: 0.10 },
  { left: "46%", w: 2.5, opacity: 0.30 },
  { left: "48%", w: 1, opacity: 0.12 },
  { left: "50%", w: 3, opacity: 0.35 },
  { left: "52%", w: 1, opacity: 0.14 },
  { left: "54%", w: 2.5, opacity: 0.28 },
  { left: "57%", w: 1, opacity: 0.10 },
  { left: "60%", w: 2, opacity: 0.20 },
  { left: "64%", w: 1, opacity: 0.08 },
  { left: "68%", w: 1.5, opacity: 0.16 },
  { left: "73%", w: 1, opacity: 0.06 },
  { left: "77%", w: 2, opacity: 0.12 },
  { left: "82%", w: 1, opacity: 0.04 },
  { left: "88%", w: 1.5, opacity: 0.08 },
  { left: "92%", w: 1, opacity: 0.05 },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 md:pt-44 md:pb-28">
      {/* ── Aurora lines ── */}
      <div className="aurora">
        {LINES.map((line, i) => (
          <div
            key={i}
            className="aurora-line"
            style={{
              left: line.left,
              width: `${line.w}px`,
              background: `linear-gradient(180deg, transparent 0%, rgba(108,92,231,${line.opacity}) 25%, rgba(162,155,254,${line.opacity * 1.4}) 50%, rgba(108,92,231,${line.opacity}) 75%, transparent 100%)`,
            }}
          />
        ))}
        <div className="aurora-glow" />
      </div>

      {/* ── Hero glow ── */}
      <div className="hero-glow" />

      <div className="relative z-10 mx-auto max-w-[900px] px-5 text-center sm:px-8">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[13px] text-text-secondary">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
          Free Chrome Extension — v2.0
        </div>

        {/* Headline */}
        <h1 className="text-[2.75rem] leading-[1.08] font-extrabold tracking-[-0.035em] text-white sm:text-[3.5rem] md:text-[4.25rem] md:leading-[1.05]">
          Ship faster with{" "}
          <span className="text-gradient">tracking</span> for modern
          ecommerce teams
        </h1>

        <p className="mx-auto mt-6 max-w-[580px] text-[16px] leading-relaxed text-text-secondary sm:mt-7 sm:text-[17px]">
          Detect CMS, generate & audit GA4, Meta, TikTok and Pinterest events,
          monitor your dataLayer in real time — from one Chrome side panel.
        </p>

        {/* CTAs */}
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row sm:gap-4">
          <a
            href={CHROME_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-flex items-center gap-2.5 rounded-xl px-7 py-3.5 text-[15px] font-semibold"
          >
            <ChromeIcon size={20} />
            Add to Chrome — Free
          </a>
          <a
            href="#features"
            className="btn-ghost inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-[15px] font-semibold"
          >
            See how it works
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 12l4-4-4-4" /></svg>
          </a>
        </div>

        {/* Code block */}
        <div className="mx-auto mt-16 max-w-[640px] text-left sm:mt-20">
          <div className="code-block">
            <div className="code-block-header">
              <div className="code-dot bg-[#FF5F57]" />
              <div className="code-dot bg-[#FEBC2E]" />
              <div className="code-dot bg-[#28C840]" />
              <span className="ml-3 text-[11px] text-text-dim font-mono">dataLayer — live</span>
            </div>
            <div className="code-content">
              <div><span className="syn-comment">{"// Traacky auto-detects your ecommerce data"}</span></div>
              <div><span className="syn-keyword">window</span><span className="syn-punct">.</span><span className="syn-func">dataLayer</span><span className="syn-punct">.</span><span className="syn-func">push</span><span className="syn-punct">({"{"}</span></div>
              <div>{"  "}<span className="syn-prop">event</span><span className="syn-punct">:</span> <span className="syn-string">&apos;purchase&apos;</span><span className="syn-punct">,</span></div>
              <div>{"  "}<span className="syn-prop">ecommerce</span><span className="syn-punct">:</span> <span className="syn-punct">{"{"}</span></div>
              <div>{"    "}<span className="syn-prop">transaction_id</span><span className="syn-punct">:</span> <span className="syn-string">&apos;T-12345&apos;</span><span className="syn-punct">,</span></div>
              <div>{"    "}<span className="syn-prop">value</span><span className="syn-punct">:</span> <span className="syn-number">149.99</span><span className="syn-punct">,</span></div>
              <div>{"    "}<span className="syn-prop">currency</span><span className="syn-punct">:</span> <span className="syn-string">&apos;USD&apos;</span><span className="syn-punct">,</span></div>
              <div>{"    "}<span className="syn-prop">items</span><span className="syn-punct">:</span> <span className="syn-punct">[{"{"}</span> <span className="syn-prop">item_name</span><span className="syn-punct">:</span> <span className="syn-string">&apos;Premium Sneakers&apos;</span><span className="syn-punct">,</span> <span className="syn-prop">price</span><span className="syn-punct">:</span> <span className="syn-number">149.99</span> <span className="syn-punct">{"}"}]</span></div>
              <div>{"  "}<span className="syn-punct">{"}"}</span></div>
              <div><span className="syn-punct">{"});"}</span></div>
              <div className="mt-3 border-t border-white/[0.04] pt-3">
                <div><span className="syn-check">{"✓"}</span> <span className="text-text-secondary">GA4 purchase event generated</span></div>
                <div><span className="syn-check">{"✓"}</span> <span className="text-text-secondary">Meta Purchase pixel matched</span></div>
                <div><span className="syn-check">{"✓"}</span> <span className="text-text-secondary">TikTok CompletePayment detected</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

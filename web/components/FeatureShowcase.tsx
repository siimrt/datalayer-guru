"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

export default function FeatureShowcase() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.08 }
    );
    ref.current?.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="section-divider py-24 sm:py-28 md:py-32">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Text */}
          <div className="fade-in">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3.5 py-1 text-[12px] font-semibold text-primary-light">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0l2 5.5H16l-4.5 3.5L13 16 8 12 3 16l1.5-7L0 5.5h6z"/></svg>
              Killer Feature
            </div>
            <h2 className="text-[1.75rem] font-bold tracking-tight text-white sm:text-[2rem] md:text-[2.25rem]">
              Push events directly into Shopify custom pixels
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-text-secondary">
              TrackPulse auto-detects Shopify custom pixel sandboxes and pushes
              real purchase events directly into them — no code, no
              configuration. The only tool that bridges generated events and
              Shopify&apos;s sandboxed pixel environment.
            </p>

            <ul className="mt-7 space-y-3.5">
              {[
                "Auto-detects custom pixel sandbox iframes",
                "Pushes purchase, add_to_cart, and all standard events",
                "Works across Checkout Extensibility pages",
                "Zero configuration required",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-[14px] text-text-secondary">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-success" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm3.78 5.22a.75.75 0 0 0-1.06 0L7 8.94 5.28 7.22a.75.75 0 1 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25a.75.75 0 0 0 0-1.06z" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Screenshot */}
          <div className="fade-in" style={{ transitionDelay: "120ms" }}>
            <div className="browser-frame">
              <div className="browser-frame-bar">
                <div className="browser-dot bg-[#FF5F57]" />
                <div className="browser-dot bg-[#FEBC2E]" />
                <div className="browser-dot bg-[#28C840]" />
                <span className="ml-4 text-[11px] text-text-dim font-mono">
                  shopify.com/checkout/thank-you
                </span>
              </div>
              <Image
                src="/screenshots/screenshot-5-push-purchase.png"
                alt="TrackPulse pushing purchase events into Shopify custom pixel"
                width={1280}
                height={800}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

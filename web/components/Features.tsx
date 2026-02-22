"use client";

import { useEffect, useRef } from "react";

const FEATURES = [
  {
    title: "CMS Detection",
    description:
      "Instantly detects Shopify, WooCommerce, PrestaShop, Magento and Webflow — auto-extracting product, collection and order data.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    title: "Event Generation",
    description:
      "Auto-generates properly structured GA4, Meta, TikTok and Pinterest tracking events from detected ecommerce data.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    title: "DataLayer Live",
    description:
      "Real-time monitoring of every dataLayer push — see events flow through GTM with structured, syntax-highlighted output.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    title: "Pixel Detection",
    description:
      "Finds active GA4, Meta Pixel, TikTok Pixel, Pinterest Tag, Snap Pixel and LinkedIn Insight tags on any page.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    ),
  },
  {
    title: "Event Audit",
    description:
      "Compares generated events against what your pixels actually fire — instantly spot missing or misconfigured parameters.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    title: "Funnel Mode",
    description:
      "Navigate Home → Collection → Product → Cart → Checkout and generate the complete tracking event sequence automatically.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
      </svg>
    ),
  },
];

export default function Features() {
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
    <section id="features" ref={ref} className="py-24 sm:py-28 md:py-32">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
        <div className="fade-in mb-14 text-center sm:mb-16">
          <h2 className="text-[1.75rem] font-bold tracking-tight text-white sm:text-[2rem] md:text-[2.5rem]">
            Everything you need to audit ecommerce tracking
          </h2>
          <p className="mx-auto mt-4 max-w-[540px] text-text-secondary">
            From CMS detection to pixel validation — TrackPulse covers the full tracking audit workflow.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="fade-in card card-hover p-6 sm:p-7"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 text-primary-light">
                {f.icon}
              </div>
              <h3 className="mb-2 text-[15px] font-semibold text-white">
                {f.title}
              </h3>
              <p className="text-[14px] leading-relaxed text-text-muted">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

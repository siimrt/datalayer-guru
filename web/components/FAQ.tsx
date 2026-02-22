"use client";

import { useState, useEffect, useRef } from "react";

const FAQS = [
  {
    q: "Is TrackPulse free?",
    a: "Yes! The free plan gives you CMS detection, basic GA4 event generation, dataLayer live view, pixel detection, and 5 audits per day. Upgrade anytime for access to all platforms, funnel mode, and push to custom pixel.",
  },
  {
    q: "Which CMS platforms are supported?",
    a: "TrackPulse auto-detects Shopify, WooCommerce, PrestaShop, Magento, and Webflow. It extracts product, collection, cart, and order data automatically from each platform.",
  },
  {
    q: "Which tracking platforms does TrackPulse support?",
    a: "TrackPulse generates and audits events for Google Analytics 4 (GA4), Meta Pixel (Facebook), TikTok Pixel, Pinterest Tag, and more coming soon. It also detects GTM, Snap Pixel, and LinkedIn Insight Tag.",
  },
  {
    q: "How does push to custom pixel work?",
    a: "TrackPulse detects Shopify custom pixel sandbox iframes on checkout and thank-you pages. It then pushes properly formatted purchase events directly into those sandboxes — no code required. This bridges the gap between your generated events and Shopify's sandboxed pixel environment.",
  },
  {
    q: "Is my data safe?",
    a: "TrackPulse runs entirely in your browser. No ecommerce data, page content, or tracking events are sent to any external server. Everything stays local in your Chrome session.",
  },
  {
    q: "Does it work with headless / custom storefronts?",
    a: "TrackPulse works best with standard CMS themes (Shopify Liquid, WooCommerce templates, etc.). Headless storefronts with custom frontends may not be fully detected, but pixel detection and dataLayer monitoring work on any site.",
  },
  {
    q: "Can I use TrackPulse for client audits?",
    a: "Absolutely. The Pro and Agency plans include export features (JSON, CSV) and funnel mode, making it easy to generate comprehensive tracking audit reports for clients.",
  },
  {
    q: "How do I install TrackPulse?",
    a: "Click 'Add to Chrome' to install from the Chrome Web Store. Once installed, click the TrackPulse icon in your toolbar to open the side panel on any ecommerce site.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
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
    <section id="faq" ref={ref} className="py-24 sm:py-28 md:py-32">
      <div className="mx-auto max-w-[680px] px-5 sm:px-8">
        <div className="fade-in mb-12 text-center">
          <h2 className="text-[1.75rem] font-bold tracking-tight text-white sm:text-[2rem] md:text-[2.5rem]">
            Frequently asked questions
          </h2>
        </div>

        <div className="space-y-2.5">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="fade-in card overflow-hidden"
              style={{ transitionDelay: `${i * 40}ms` }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left sm:px-6"
              >
                <span className="pr-4 text-[14px] font-semibold text-white">
                  {faq.q}
                </span>
                <svg
                  className={`h-4 w-4 shrink-0 text-text-dim transition-transform duration-300 ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </button>

              <div className={`faq-content ${openIndex === i ? "open" : ""}`}>
                <div>
                  <p className="px-5 pb-4 text-[14px] leading-relaxed text-text-muted sm:px-6">
                    {faq.a}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

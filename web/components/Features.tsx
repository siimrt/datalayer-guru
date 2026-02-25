"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

const FEATURES = [
  {
    title: "Real-time DataLayer inspector.",
    tagline: "See every push as it happens — structured, syntax-highlighted, live.",
    description:
      "Monitor every dataLayer.push in real time as events flow through GTM. Structured output with full payload inspection, filtering, and auto-scroll. No more console.log debugging.",
    visual: "/screenshots/screenshot-3-pixels-datalayer.png",
    alt: "Traacky DataLayer live inspector",
  },
  {
    title: "One-click event generation.",
    tagline: "From page data to tracking events — automatically.",
    description:
      "Traacky detects your CMS, extracts product, collection, cart and order data, then generates properly structured GA4, Meta, TikTok and Pinterest events. Zero manual mapping.",
    visual: "/screenshots/screenshot-1-events.png",
    alt: "Traacky generating tracking events",
  },
  {
    title: "Smart pixel detection.",
    tagline: "Every active pixel on the page — found in seconds.",
    description:
      "Finds GA4, Meta Pixel, TikTok Pixel, Pinterest Tag, Snap Pixel, LinkedIn Insight Tag and GTM containers on any page. See pixel IDs, load status, and detected events at a glance.",
    visual: null,
    alt: "",
  },
  {
    title: "Push to custom pixels.",
    tagline: "Bridge the gap between events and Shopify sandboxes.",
    description:
      "Auto-detects Shopify custom pixel sandbox iframes and pushes real purchase events directly into them — no code, no configuration. The only tool that bridges generated events and Shopify's sandboxed pixel environment.",
    visual: "/screenshots/screenshot-5-push-purchase.png",
    alt: "Traacky pushing events to Shopify custom pixels",
  },
  {
    title: "Zero configuration.",
    tagline: "Install. Open any ecommerce site. It just works.",
    description:
      "Auto-detects Shopify, WooCommerce, PrestaShop, Magento and Webflow. Extracts page type, product data, cart contents and order details automatically. No setup, no tokens, no permissions.",
    visual: null,
    alt: "",
  },
];

export default function Features() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        }),
      { threshold: 0.08 }
    );
    ref.current
      ?.querySelectorAll(".fade-in")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" ref={ref} className="py-24 sm:py-28 md:py-32">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
        {/* Heading */}
        <div className="fade-in mb-6 sm:mb-8">
          <p className="mb-4 text-[13px] font-semibold tracking-[0.1em] text-primary-light uppercase">
            Features
          </p>
          <h2 className="text-[1.75rem] font-bold tracking-tight text-white sm:text-[2rem] md:text-[2.75rem] md:leading-[1.1]">
            Tracking tools for the{" "}
            <span className="text-gradient">modern ecommerce stack</span>
          </h2>
          <p className="mt-4 max-w-[580px] text-[16px] leading-relaxed text-text-secondary">
            From CMS detection to pixel validation — Traacky covers the full
            tracking audit workflow in one side panel.
          </p>
        </div>

        {/* Feature list (editorial, neon-style) */}
        <div>
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`fade-in border-b border-white/[0.04] py-12 last:border-b-0 md:py-16 ${
                f.visual ? "grid items-center gap-8 md:grid-cols-2 md:gap-12" : ""
              }`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              {/* Text */}
              <div className={!f.visual ? "max-w-[680px]" : ""}>
                <h3 className="text-[1.25rem] font-bold tracking-tight text-white sm:text-[1.5rem] md:text-[1.75rem]">
                  <span className="text-gradient">{f.title}</span>{" "}
                  <span className="text-text-secondary font-normal">
                    {f.tagline}
                  </span>
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-text-muted">
                  {f.description}
                </p>
              </div>

              {/* Visual */}
              {f.visual && (
                <div
                  className={`browser-frame ${i % 2 === 0 ? "" : "md:order-first"}`}
                >
                  <div className="browser-frame-bar">
                    <div className="browser-dot bg-[#FF5F57]" />
                    <div className="browser-dot bg-[#FEBC2E]" />
                    <div className="browser-dot bg-[#28C840]" />
                    <span className="ml-4 text-[11px] text-text-dim font-mono">
                      traacky
                    </span>
                  </div>
                  <Image
                    src={f.visual}
                    alt={f.alt}
                    width={1280}
                    height={800}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

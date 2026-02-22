"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

const TABS = [
  { title: "Event Generation", screenshot: "/screenshots/screenshot-1-events.png", alt: "TrackPulse generating tracking events" },
  { title: "Event Audit", screenshot: "/screenshots/screenshot-2-audit.png", alt: "TrackPulse auditing tracking events" },
  { title: "Pixel & DataLayer", screenshot: "/screenshots/screenshot-3-pixels-datalayer.png", alt: "TrackPulse pixel detection and dataLayer monitoring" },
  { title: "Funnel & Pricing", screenshot: "/screenshots/screenshot-4-funnel-pricing.png", alt: "TrackPulse funnel mode" },
  { title: "Push to Pixel", screenshot: "/screenshots/screenshot-5-push-purchase.png", alt: "TrackPulse pushing events to custom pixels" },
];

export default function Screenshots() {
  const [active, setActive] = useState(0);
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
    <section ref={ref} className="py-24 sm:py-28 md:py-32">
      <div className="mx-auto max-w-[960px] px-5 sm:px-8">
        <div className="fade-in mb-10 text-center sm:mb-12">
          <h2 className="text-[1.75rem] font-bold tracking-tight text-white sm:text-[2rem] md:text-[2.5rem]">
            See TrackPulse in action
          </h2>
          <p className="mx-auto mt-4 max-w-[480px] text-text-secondary">
            A full tracking audit toolkit — right in your browser side panel.
          </p>
        </div>

        {/* Tabs */}
        <div className="fade-in mb-6 flex flex-wrap justify-center gap-1.5 sm:mb-8">
          {TABS.map((tab, i) => (
            <button
              key={tab.title}
              onClick={() => setActive(i)}
              className={`rounded-lg px-3.5 py-2 text-[13px] font-medium transition-all ${
                active === i
                  ? "bg-primary text-white shadow-[0_0_16px_rgba(108,92,231,0.2)]"
                  : "text-text-muted hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>

        {/* Screenshot */}
        <div className="fade-in" style={{ transitionDelay: "80ms" }}>
          <div className="browser-frame">
            <div className="browser-frame-bar">
              <div className="browser-dot bg-[#FF5F57]" />
              <div className="browser-dot bg-[#FEBC2E]" />
              <div className="browser-dot bg-[#28C840]" />
              <span className="ml-4 text-[11px] text-text-dim font-mono">
                chrome-extension://trackpulse
              </span>
            </div>
            <Image
              src={TABS[active].screenshot}
              alt={TABS[active].alt}
              width={1280}
              height={800}
              className="w-full"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}

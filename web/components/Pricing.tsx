"use client";

import { useEffect, useRef } from "react";
import ChromeIcon from "./ChromeIcon";

const CHROME_STORE_URL = "https://chromewebstore.google.com/detail/trackpulse/";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with essential tracking tools",
    features: [
      "CMS & page type detection",
      "Basic event generation (GA4)",
      "DataLayer live view",
      "Pixel detection",
      "5 audits per day",
    ],
    cta: "Add to Chrome",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$9",
    period: "/month",
    description: "For freelancers and solo marketers",
    features: [
      "Everything in Free",
      "GA4 + Meta event generation",
      "Unlimited audits",
      "Event export (JSON / CSV)",
      "Priority support",
    ],
    cta: "Get Starter",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/mo",
    description: "For agencies and power users",
    features: [
      "Everything in Starter",
      "All platforms (TikTok, Pinterest…)",
      "Push to custom pixel",
      "Funnel mode",
      "Bulk export & reports",
    ],
    cta: "Get Pro",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Agency",
    price: "$49",
    period: "/mo",
    description: "For teams managing multiple clients",
    features: [
      "Everything in Pro",
      "Up to 5 team seats",
      "Client workspace profiles",
      "White-label exports",
      "Dedicated support channel",
    ],
    cta: "Get Agency",
    highlighted: false,
  },
];

export default function Pricing() {
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
    <section id="pricing" ref={ref} className="section-divider py-24 sm:py-28 md:py-32">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
        <div className="fade-in mb-14 text-center sm:mb-16">
          <h2 className="text-[1.75rem] font-bold tracking-tight text-white sm:text-[2rem] md:text-[2.5rem]">
            Simple, transparent pricing
          </h2>
          <p className="mx-auto mt-4 max-w-[480px] text-text-secondary">
            Start free and upgrade when you need more. All paid plans include a
            30-day money-back guarantee.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, i) => (
            <div
              key={plan.name}
              className={`fade-in relative flex flex-col rounded-2xl border p-6 ${
                plan.highlighted
                  ? "popular-card border-primary/30 bg-primary/[0.04]"
                  : "border-white/[0.06] bg-white/[0.02]"
              }`}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold text-white shadow-[0_0_16px_rgba(108,92,231,0.3)]">
                  {plan.badge}
                </div>
              )}

              <h3 className="text-[15px] font-bold text-white">{plan.name}</h3>
              <p className="mt-1 text-[13px] text-text-dim">{plan.description}</p>

              <div className="mt-5 mb-6">
                <span className="text-[2rem] font-extrabold tracking-tight text-white">
                  {plan.price}
                </span>
                <span className="text-[13px] text-text-dim">{plan.period}</span>
              </div>

              <ul className="mb-7 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-text-secondary">
                    <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={CHROME_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold transition-all ${
                  plan.highlighted
                    ? "btn-primary"
                    : "btn-ghost"
                }`}
              >
                {(plan.name === "Free") && <ChromeIcon size={14} />}
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-[13px] text-text-dim">
          All paid plans include a 30-day money-back guarantee. Cancel anytime.
        </p>
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";

export const metadata: Metadata = {
  title: "Privacy Policy — TrackPulse",
  description:
    "TrackPulse privacy policy. Learn how we handle your data — spoiler: everything stays in your browser.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="border-b border-white/[0.04] bg-black/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[800px] items-center gap-2.5 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#1A1A2E] to-[#0F0F10]">
              <AppIcon size={18} />
            </div>
            <span className="text-[14px] font-semibold text-white">TrackPulse</span>
          </Link>
          <span className="text-text-dim">/</span>
          <span className="text-[14px] text-text-muted">Privacy Policy</span>
        </div>
      </nav>

      <main className="mx-auto max-w-[800px] px-5 py-16 sm:px-8 sm:py-20">
        <h1 className="text-[2rem] font-bold tracking-tight text-white sm:text-[2.5rem]">
          Privacy Policy
        </h1>
        <p className="mt-2 text-[14px] text-text-dim">
          Last updated: February 2026
        </p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-text-secondary">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">Overview</h2>
            <p>
              TrackPulse is a Chrome extension that helps ecommerce professionals
              inspect, generate, and audit tracking events. We are committed to
              protecting your privacy. This policy explains what data we collect (very
              little) and how we handle it.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Data Collection
            </h2>
            <p>
              <strong className="text-white">TrackPulse runs entirely in your browser.</strong>{" "}
              We do not collect, transmit, or store any of the following:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-text-muted">
              <li>Page content or URLs you visit</li>
              <li>Ecommerce product data, prices, or order information</li>
              <li>Tracking events, dataLayer pushes, or pixel data</li>
              <li>Personal information or browsing history</li>
              <li>Cookies or session data from visited websites</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              What We Do Store
            </h2>
            <ul className="list-disc space-y-1.5 pl-5 text-text-muted">
              <li>
                <strong className="text-text-secondary">Extension preferences:</strong>{" "}
                Your settings (theme, default platform, etc.) are stored locally
                in Chrome&apos;s <code className="rounded bg-white/5 px-1.5 py-0.5 text-[13px] font-mono text-primary-light">chrome.storage.local</code>.
              </li>
              <li>
                <strong className="text-text-secondary">License status:</strong>{" "}
                If you have a paid plan, your license status is verified through
                ExtensionPay. We store a license key locally — no personal
                payment data is stored in the extension.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Third-Party Services
            </h2>
            <ul className="list-disc space-y-1.5 pl-5 text-text-muted">
              <li>
                <strong className="text-text-secondary">ExtensionPay:</strong>{" "}
                Used for subscription management. ExtensionPay processes payments
                through Stripe. See{" "}
                <a href="https://extensionpay.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-light underline underline-offset-2 hover:text-white">
                  ExtensionPay&apos;s Privacy Policy
                </a>.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Permissions
            </h2>
            <p>TrackPulse requests the following Chrome permissions:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-text-muted">
              <li>
                <code className="rounded bg-white/5 px-1.5 py-0.5 text-[13px] font-mono text-primary-light">activeTab</code>{" "}
                — To inspect the current page&apos;s tracking setup
              </li>
              <li>
                <code className="rounded bg-white/5 px-1.5 py-0.5 text-[13px] font-mono text-primary-light">storage</code>{" "}
                — To save your preferences locally
              </li>
              <li>
                <code className="rounded bg-white/5 px-1.5 py-0.5 text-[13px] font-mono text-primary-light">sidePanel</code>{" "}
                — To display the TrackPulse interface
              </li>
              <li>
                <code className="rounded bg-white/5 px-1.5 py-0.5 text-[13px] font-mono text-primary-light">scripting</code>{" "}
                — To inject detection scripts into pages
              </li>
              <li>
                <code className="rounded bg-white/5 px-1.5 py-0.5 text-[13px] font-mono text-primary-light">webNavigation</code>{" "}
                — To detect page navigation for funnel mode
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Data Security
            </h2>
            <p>
              Since all data processing happens locally in your browser, there is
              no server-side data to protect. Your ecommerce data never leaves
              your machine.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Changes to This Policy
            </h2>
            <p>
              We may update this privacy policy from time to time. Any changes
              will be posted on this page with an updated revision date.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">Contact</h2>
            <p>
              If you have any questions about this privacy policy, please contact
              us at{" "}
              <a
                href="mailto:contact@trackpulse.dev"
                className="text-primary-light underline underline-offset-2 hover:text-white"
              >
                contact@trackpulse.dev
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-white/[0.04] pt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[14px] font-medium text-primary-light transition-colors hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 12l-4-4 4-4"/></svg>
            Back to TrackPulse
          </Link>
        </div>
      </main>
    </div>
  );
}

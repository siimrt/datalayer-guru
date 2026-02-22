import AppIcon from "./AppIcon";

const CHROME_STORE_URL = "https://chromewebstore.google.com/detail/trackpulse/";

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.04] py-10 sm:py-12">
      <div className="mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-6 px-5 sm:flex-row sm:px-8">
        {/* Logo + tagline */}
        <div className="flex flex-col items-center gap-1.5 sm:items-start">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#1A1A2E] to-[#0F0F10]">
              <AppIcon size={16} />
            </div>
            <span className="text-[13px] font-semibold text-white">TrackPulse</span>
          </div>
          <p className="text-[12px] text-text-dim">
            Made for tracking professionals
          </p>
        </div>

        {/* Links */}
        <div className="flex items-center gap-6">
          <a
            href={CHROME_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-text-muted transition-colors hover:text-white"
          >
            Chrome Web Store
          </a>
          <a
            href="/privacy"
            className="text-[13px] text-text-muted transition-colors hover:text-white"
          >
            Privacy Policy
          </a>
          <a
            href="mailto:contact@trackpulse.dev"
            className="text-[13px] text-text-muted transition-colors hover:text-white"
          >
            Contact
          </a>
        </div>

        {/* Copyright */}
        <p className="text-[12px] text-text-dim">
          &copy; {new Date().getFullYear()} TrackPulse
        </p>
      </div>
    </footer>
  );
}

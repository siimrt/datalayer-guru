import AppIcon from "./AppIcon";

const CHROME_STORE_URL = "https://chromewebstore.google.com/detail/traacky/gbanfpfljdeeililjkaejmljnckmoged";

export default function Footer() {
  return (
    <footer className="border-t border-black/[0.06] py-10 sm:py-12">
      <div className="mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-6 px-5 sm:flex-row sm:px-8">
        {/* Logo + tagline */}
        <div className="flex flex-col items-center gap-1.5 sm:items-start">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#e6f4f5] to-[#cce8ea]">
              <AppIcon size={16} />
            </div>
            <span className="text-[13px] font-semibold text-text">
              Traacky
            </span>
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
            className="text-[13px] text-text-muted transition-colors hover:text-primary"
          >
            Chrome Web Store
          </a>
          <a
            href="/privacy"
            className="text-[13px] text-text-muted transition-colors hover:text-primary"
          >
            Privacy Policy
          </a>
          <a
            href="mailto:contact@traacky.com"
            className="text-[13px] text-text-muted transition-colors hover:text-primary"
          >
            Contact
          </a>
        </div>

        {/* Copyright */}
        <p className="text-[12px] text-text-dim">
          &copy; {new Date().getFullYear()} Traacky
        </p>
      </div>
    </footer>
  );
}

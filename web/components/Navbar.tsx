"use client";

import AppIcon from "./AppIcon";
import ChromeIcon from "./ChromeIcon";

const CHROME_STORE_URL = "https://chromewebstore.google.com/detail/traacky/gbanfpfljdeeililjkaejmljnckmoged";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/[0.06]">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-3 sm:px-8 sm:py-4">
        {/* Logo */}
        <a href="#" className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#e6f4f5] to-[#cce8ea] shadow-[0_0_12px_rgba(0,109,119,0.12)]">
            <AppIcon size={22} />
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-text">
            Traacky
          </span>
        </a>

        {/* Center links */}
        <div className="hidden items-center gap-7 md:flex">
          {["Features", "Pricing", "FAQ"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-[13px] font-medium text-text-muted transition-colors hover:text-primary"
            >
              {item}
            </a>
          ))}
        </div>

        {/* CTA */}
        <a
          href={CHROME_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold sm:px-4"
        >
          <ChromeIcon size={16} />
          <span className="hidden sm:inline">Add to Chrome</span>
          <span className="sm:hidden">Install</span>
        </a>
      </div>
    </nav>
  );
}

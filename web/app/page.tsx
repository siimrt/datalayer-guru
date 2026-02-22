import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import LogoCloud from "@/components/LogoCloud";
import Features from "@/components/Features";
import FeatureShowcase from "@/components/FeatureShowcase";
import Screenshots from "@/components/Screenshots";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <LogoCloud />
        <Features />
        <FeatureShowcase />
        <Screenshots />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}

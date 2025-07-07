// app/page.tsx
import React from "react";
import HeroSection from "@/components/home/HeroSection";
import FeaturesSection from "@/components/home/FeaturesSection";
import ComponentShowcase from "@/components/home/ComponentShowcase";

export default function Home() {
  return (
    
    <>
      <HeroSection />
      <FeaturesSection />
      <ComponentShowcase />

    </>
    
  );
}

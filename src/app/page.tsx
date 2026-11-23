// app/page.tsx
import HeroSection from "@/components/home/HeroSection";
import FeaturesSection from "@/components/home/FeaturesSection";
export default function Home() {
  return (
    
    <>
      <h1 className="sr-only">OaZ · One and Zero</h1>
      <HeroSection />
      <FeaturesSection />
    </>
    
  );
}

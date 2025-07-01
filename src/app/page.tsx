import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowRight, 
  Copy, 
  Palette, 
  Accessibility, 
  Zap,
  Code2,
  Sparkles,
  Github,
  Twitter,
  ExternalLink
} from "lucide-react";
import { motion } from "framer-motion";

import Navigation from "@/components/home/Navigation";
import HeroSection from "@/components/home/HeroSection";
import FeaturesSection from "@/components/home/FeaturesSection";
import ComponentShowcase from "@/components/home/ComponentShowcase";
import Footer from "@/components/home/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Background gradients */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-50 pointer-events-none" />
      <div className="fixed top-0 left-1/2 transform -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-r from-blue-50/50 via-purple-50/30 to-pink-50/50 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative">
        <Navigation />
        <HeroSection />
        <FeaturesSection />
        <ComponentShowcase />
        <Footer />
      </div>
    </div>
  );
}
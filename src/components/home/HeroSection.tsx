'use client';

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Copy, ExternalLink, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function HeroSection() {
  const copyCommand = "npx shadcn-ui@latest init";

  const handleCopy = () => {
    navigator.clipboard.writeText(copyCommand);
  };

  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">

        {/* Main Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="mb-8"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="mb-8"
          >
            <video
              src="/oaz.webm"
              autoPlay
              muted
              playsInline
              className="mx-auto w-[360px] sm:w-[480px] lg:w-[640px]"
            />
            <p className="text-base sm:text-lg lg:text-xl mt-4 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 bg-clip-text text-transparent font-bold">
              - Korea University E.E. Software Society -
            </p>
          </motion.div>
          
          <p className="text-xl sm:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed font-light">
            Beautifully designed components that you can copy and paste into your apps. 
            Accessible. Customizable. Open Source.
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
        >
          <Button 
            size="lg" 
            className="bg-black hover:bg-gray-800 text-white px-8 py-4 text-lg font-medium group"
          >
            Get Started
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          
          <Button 
            variant="outline" 
            size="lg"
            className="border-gray-300 hover:bg-gray-50 px-8 py-4 text-lg font-medium"
          >
            <ExternalLink className="mr-2 w-5 h-5" />
            View on GitHub
          </Button>
        </motion.div>

        {/* Installation Command */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="max-w-lg mx-auto"
        >
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between group hover:bg-gray-100 transition-colors">
            <code className="text-sm font-mono text-gray-800 flex-1">
              {copyCommand}
            </code>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              className="ml-2 opacity-70 group-hover:opacity-100 hover:bg-white"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
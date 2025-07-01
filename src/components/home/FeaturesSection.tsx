"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Palette, Accessibility, Zap, Code2, Copy, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function FeaturesSection() {
  const features = [
    {
      icon: Copy,
      title: "Copy & Paste",
      description: "Copy and paste components into your apps. Customize to your heart's content.",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: Accessibility,
      title: "Accessible",
      description: "Components are built with accessibility in mind. Tested with screen readers.",
      gradient: "from-purple-500 to-pink-500"
    },
    {
      icon: Palette,
      title: "Customizable",
      description: "Built with Tailwind CSS. Customize colors, spacing, typography and more.",
      gradient: "from-orange-500 to-red-500"
    },
    {
      icon: Code2,
      title: "Developer Experience",
      description: "Built by developers for developers. Simple, clean, and easy to use.",
      gradient: "from-green-500 to-emerald-500"
    },
    {
      icon: Zap,
      title: "Modern Stack",
      description: "Built with the latest technologies. React, TypeScript, Tailwind CSS.",
      gradient: "from-yellow-500 to-orange-500"
    },
    {
      icon: Sparkles,
      title: "Beautiful Design",
      description: "Beautifully designed components with attention to every detail.",
      gradient: "from-indigo-500 to-purple-500"
    }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Why choose shadcn/ui?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            A component library that gives you everything you need to build beautiful, 
            accessible, and customizable user interfaces.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ y: -5 }}
              className="group"
            >
              <Card className="h-full border-gray-200 hover:border-gray-300 transition-all duration-300 hover:shadow-lg bg-white/50 backdrop-blur-sm">
                <CardContent className="p-8">
                  <div className="mb-6">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${feature.gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
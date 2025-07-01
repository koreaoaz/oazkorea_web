"use client";

import React from "react";
import { Github, Twitter, Heart } from "lucide-react";
import { motion } from "framer-motion";

export default function Footer() {
  const links = {
    Product: [
      { name: "Documentation", href: "#" },
      { name: "Components", href: "#" },
      { name: "Examples", href: "#" },
      { name: "Blocks", href: "#" },
    ],
    Resources: [
      { name: "GitHub", href: "#" },
      { name: "Twitter", href: "#" },
      { name: "Discord", href: "#" },
      { name: "Changelog", href: "#" },
    ],
    Community: [
      { name: "Discord", href: "#" },
      { name: "Twitter", href: "#" },
      { name: "GitHub", href: "#" },
      { name: "Discussions", href: "#" },
    ]
  };

  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo and Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="col-span-1 md:col-span-1"
          >
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-black rounded-md flex items-center justify-center">
                <div className="w-4 h-4 bg-white rounded-sm" />
              </div>
              <span className="text-xl font-bold">shadcn/ui</span>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Beautifully designed components that you can copy and paste into your apps. 
              Accessible. Customizable. Open Source.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-gray-600 transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-600 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </motion.div>

          {/* Links */}
          {Object.entries(links).map(([category, items], categoryIndex) => (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: categoryIndex * 0.1 }}
              viewport={{ once: true }}
            >
              <h3 className="font-semibold text-gray-900 mb-4">{category}</h3>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.name}>
                    <a 
                      href={item.href}
                      className="text-gray-600 hover:text-gray-900 text-sm transition-colors"
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Bottom Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="border-t border-gray-200 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center"
        >
          <p className="text-gray-600 text-sm flex items-center">
            Built with <Heart className="w-4 h-4 text-red-500 mx-1" /> by{" "}
            <a href="#" className="font-medium text-gray-900 ml-1 hover:underline">
              shadcn
            </a>
          </p>
          <p className="text-gray-600 text-sm mt-4 sm:mt-0">
            © 2024 shadcn/ui. All rights reserved.
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
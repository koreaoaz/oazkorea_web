'use client';

import { motion } from "framer-motion";
import {MobileLogo} from './MobileLogo';

export default function HeroSection() {
  return (
    <section className="mobile-home-hero pt-8 pb-2 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">

        {/* Main Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="mb-2"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="mb-2"
          >
            <MobileLogo/>
            <p className="text-base sm:text-lg lg:text-xl mt-4 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 bg-clip-text text-transparent font-bold">
              - Korea University E.E. Software Society -
            </p>
          </motion.div>
          
        </motion.div>
      </div>
    </section>
  );
}

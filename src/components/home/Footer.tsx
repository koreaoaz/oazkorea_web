"use client";


import {VisitPrivacy} from '@/components/VisitPrivacy';
import {T} from '@/components/LocaleProvider';
import { Github, Heart } from "lucide-react";
import { motion } from "framer-motion";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
       

        {/* Bottom Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          // 좌우 컬럼이 서로 높이에 영향 안 받도록: items-start + gap
          className="mt-2 pt-2 flex flex-col sm:flex-row justify-between items-start gap-6 sm:gap-8"
        >
          {/* LEFT */}
          <div className="text-gray-600 text-sm">
            <p className="text-gray-600 text-sm flex items-center">
              Built with <Heart className="w-4 h-4 text-red-500 mx-1" /> by{" "}
              <a href="#" className="font-medium text-gray-900 ml-1 hover:underline">
                OaZ
              </a>
            </p>
            <p><T text="2026 · 이영재 · 박유림 · 이유민"/></p>
            <p className="mt-2"><T text="서울특별시 성북구 안암로 145, 고려대학교 신공학관 106B"/></p>
            <VisitPrivacy settings/>
          </div>

          {/* RIGHT */}
          <div className="w-full sm:w-auto">
            <p className="text-gray-950 text-base font-bold"><T text="공식 연락처"/></p>
            <a className="mt-2 inline-block text-sm underline" href="mailto:koreaoaz@gmail.com">koreaoaz@gmail.com</a>

            {/* 소셜 아이콘 행 */}
            <div className="mt-4 flex justify-end gap-3">

              {/* GitHub */}
              <a
                href="https://github.com/koreaoaz"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="p-2 rounded-md hover:border-gray-300 hover:bg-gray-50 transition"
                title="GitHub"
              >
                <Github className="w-5 h-5 text-gray-700" />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}

'use client';

import Link from "next/link";
import { ExternalLink, Mail, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200/80 bg-white/90 backdrop-blur-xl text-zinc-700">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <Link href="/" className="flex items-center">
              <span className="font-brand font-semibold text-lg tracking-tight text-zinc-800 uppercase select-none">
                LOSTRETURN
              </span>
            </Link>
            <p className="text-xs text-zinc-500 leading-relaxed font-normal">
              ระบบตู้รับฝาก-คืนทรัพย์สินสูญหายอัตโนมัติ<br />
              ปลอดภัยด้วย IoT และ OTP
            </p>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-amber-700">ลิงก์</h4>
            <div className="space-y-2">
              <Link href="/dashboard" className="block text-xs text-zinc-600 hover:text-amber-700 transition-colors font-normal">
                Dashboard
              </Link>
              <Link href="/history" className="block text-xs text-zinc-600 hover:text-amber-700 transition-colors font-normal">
                ประวัติการใช้งาน
              </Link>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-amber-700">ติดต่อ</h4>
            <div className="space-y-2">
              <a
                href="mailto:contact@rmuti.ac.th"
                className="flex items-center gap-2 text-xs text-zinc-600 hover:text-amber-700 transition-colors font-normal"
              >
                <Mail className="w-3.5 h-3.5" />
                contact@rmuti.ac.th
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-zinc-600 hover:text-amber-700 transition-colors font-normal"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                GitHub Repository
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-zinc-200/80">
          <p className="text-center text-xs text-zinc-400 flex items-center justify-center gap-1.5 font-normal">
            Made with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> by RMUTI KKC © 2024
          </p>
        </div>
      </div>
    </footer>
  );
}
// src/components/Header.tsx
'use client'

import { Zap } from "lucide-react";
import Image from "next/image";
import { ThemeToggle } from "@/src/components/theme-toggle";
import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center rounded-lg ">
           
            <Image src="/thorfin.png" alt={""} width={25} height={25} />
          </div>
          <span className="text-lg font-semibold text-slate-900 dark:text-white">
            Thorfin
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-slate-500 md:block dark:text-slate-400">
            Save 10+ hours per week on finance prep work
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
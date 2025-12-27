// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/src/components/theme-provider";
import { Toaster } from "@/src/components/ui/toaster";
import { TooltipProvider } from "@/src/components/ui/tooltip";
import { QueryProvider } from "@/src/components/providers/query-provider";
import Header from "@/src/components/base/header"; // Import Header

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Thorfin - Finance Automation",
  description: "Save 10+ hours per week on finance prep work",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <ThemeProvider
          >
            <TooltipProvider>
              <Header />
              <main className="min-h-screen">
                {children}
              </main>
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
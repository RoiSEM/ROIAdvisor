import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ThemeSync from "@/components/theme-sync";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Convert by WhachaWant | Conversion advisor for small-business websites",
  description:
    "Learn what your website data actually shows, then decide what to do next. Practical next steps with a do-it-yourself guide or optional help.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme is corrected before first paint by THEME_INIT_SCRIPT; the
    // server cannot know the visitor's stored choice, so hydration warnings
    // on <html> are expected and suppressed (Next "preventing flash" guide).
    <html
      lang="en"
      data-theme="light"
      data-theme-preference="system"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}

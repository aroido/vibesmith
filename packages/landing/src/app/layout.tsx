import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const SITE_URL = "https://vibesmith.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "VibeSmith - AI Agent Components Manager",
    template: "%s | VibeSmith",
  },
  description:
    "Manage Skills, Agents, Commands, and Hooks for Claude Code and Cursor with a local-first desktop workflow.",
  keywords: [
    "VibeSmith",
    "Claude Code",
    "Cursor",
    "AI agent components",
    "skills manager",
    "developer tools",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "VibeSmith",
    title: "VibeSmith - AI Agent Components Manager",
    description:
      "Unified workspace for managing AI coding components across Claude Code and Cursor.",
    locale: "en_US",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "VibeSmith - AI Agent Components Manager",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeSmith - AI Agent Components Manager",
    description:
      "Local-first manager for Skills, Agents, Commands, and Hooks across Claude Code and Cursor.",
    images: ["/og-image.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}

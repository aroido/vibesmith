import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const GITHUB_RELEASES_URL = "https://github.com/aroido/vibesmith/releases";
const HOMEBREW_TAP_URL = "https://github.com/aroido/homebrew-vibesmith";
const PRODUCT_PAGE_URL = "https://aroido.com/projects/vibesmith/";
const SOURCE_BUILD_URL = "https://github.com/aroido/vibesmith#source-build";

export const metadata: Metadata = {
  title: "Download - VibeSmith",
  description:
    "Open the official VibeSmith install guide, GitHub releases, and source-build instructions.",
};

export default function DownloadPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-24 pb-16 px-6">
        <div className="max-w-2xl mx-auto space-y-12">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-50 mb-4">
              Install VibeSmith
            </h1>
            <p className="text-slate-400">
              This companion page points to the official install guide, GitHub releases, and source-build instructions.
            </p>
          </div>

          <section className="p-6 rounded-xl bg-slate-800/50 border border-slate-700">
            <h2 className="text-xl font-semibold text-slate-50 mb-4">
              Official Product and Install Guide
            </h2>
            <p className="text-slate-400 mb-4">
              Use the Aroido product page for the current product narrative, latest install guidance, and release-channel notes.
            </p>
            <a
              href={PRODUCT_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-semibold transition-colors"
            >
              Open aroido.com Install Guide
            </a>
          </section>

          {/* Source build */}
          <section className="p-6 rounded-xl bg-slate-800/50 border border-slate-700">
            <h2 className="text-xl font-semibold text-slate-50 mb-4">
              Source Build
            </h2>
            <p className="text-slate-400 mb-4">
              Use the repository build instructions when you need a local dev install or want to inspect the source directly.
            </p>
            <a
              href={SOURCE_BUILD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-semibold transition-colors"
            >
              Open Build Instructions
            </a>
          </section>

          {/* Public release channel */}
          <section className="p-6 rounded-xl bg-slate-800/50 border border-slate-700">
            <h2 className="text-xl font-semibold text-slate-50 mb-4">
              Public Release Channel
            </h2>
            <p className="text-slate-400 mb-4">
              GitHub Releases is the canonical public release channel. The newest non-draft release, including prereleases, is the public desktop install source.
            </p>
            <a
              href={GITHUB_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-slate-600 text-slate-100 hover:border-slate-500 hover:bg-slate-700/50 transition-colors"
            >
              Watch GitHub Releases
            </a>
          </section>

          {/* Package manager status */}
          <section className="p-6 rounded-xl bg-slate-800/50 border border-slate-700">
            <h2 className="text-xl font-semibold text-slate-50 mb-4">
              Package Managers
            </h2>
            <p className="text-slate-400 mb-4">
              Homebrew installs use the GitHub tap and track the same public release channel.
            </p>
            <code className="block p-4 rounded-lg bg-slate-950/70 text-slate-200 text-sm whitespace-pre-wrap">
              brew update{"\n"}
              brew tap aroido/vibesmith https://github.com/aroido/homebrew-vibesmith.git{"\n"}
              brew install --cask aroido/vibesmith/vibesmith
            </code>
            <a
              href={HOMEBREW_TAP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex mt-4 items-center gap-2 px-6 py-3 rounded-lg border border-slate-600 text-slate-100 hover:border-slate-500 hover:bg-slate-700/50 transition-colors"
            >
              Open Homebrew Tap
            </a>
          </section>

          {/* System Requirements */}
          <section className="p-6 rounded-xl bg-slate-800/50 border border-slate-700">
            <h2 className="text-xl font-semibold text-slate-50 mb-4">
              System Requirements
            </h2>
            <ul className="text-slate-400 space-y-2">
              <li>• macOS 12.0 (Monterey) or later</li>
              <li>• Apple Silicon (M1/M2/M3) or Intel (x86_64)</li>
              <li>• Minimum 100MB disk space</li>
            </ul>
          </section>

          <div className="text-center">
            <Link
              href="/"
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

import Link from "next/link";

const PRODUCT_PAGE_URL = "https://aroido.com/projects/vibesmith/";
const SOURCE_BUILD_URL = "https://github.com/aroido/vibesmith#source-build";

export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 pt-20 pb-16">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-slate-50 tracking-tight">
          AI Agent Components Manager
        </h1>
        <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
          Companion install and source-build page for VibeSmith. For the official product narrative and latest release guidance, use the Aroido product page.
        </p>
        <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={PRODUCT_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-semibold text-lg transition-colors"
          >
            Open Official Install Guide
          </Link>
          <Link
            href={SOURCE_BUILD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg border border-slate-600 text-slate-100 hover:border-slate-500 hover:bg-slate-700/50 font-semibold text-lg transition-colors"
          >
            Build from Source
          </Link>
        </div>
        <div className="pt-8">
          <div className="w-full max-w-3xl mx-auto aspect-video bg-slate-700/50 rounded-xl border border-slate-600 flex items-center justify-center">
            <span className="text-slate-400 text-sm">Use aroido.com/projects/vibesmith for the current product walkthrough.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

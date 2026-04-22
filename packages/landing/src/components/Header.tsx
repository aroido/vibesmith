import Link from "next/link";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-slate-50">
          VibeSmith
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/#features"
            className="text-slate-400 hover:text-cyan-400 transition-colors"
          >
            Features
          </Link>
          <Link
            href="/#pricing"
            className="text-slate-400 hover:text-cyan-400 transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/download"
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-semibold transition-colors"
          >
            Download
          </Link>
        </nav>
      </div>
    </header>
  );
}

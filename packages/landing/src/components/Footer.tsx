import Link from "next/link";

const GITHUB_URL = "https://github.com/aroido/vibesmith";
const GITHUB_ISSUES_URL = "https://github.com/aroido/vibesmith/issues";
const GITHUB_DISCUSSIONS_URL = "https://github.com/aroido/vibesmith/discussions";

export function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-slate-700">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-slate-400 text-sm">
          Maintained by the VibeSmith contributors.
        </div>
        <nav className="flex items-center gap-6">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-cyan-400 transition-colors"
          >
            GitHub
          </a>
          <a
            href={GITHUB_ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-cyan-400 transition-colors"
          >
            Issues
          </a>
          <a
            href={GITHUB_DISCUSSIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-cyan-400 transition-colors"
          >
            Discussions
          </a>
          <Link
            href="/download"
            className="text-slate-400 hover:text-cyan-400 transition-colors"
          >
            Download
          </Link>
        </nav>
      </div>
    </footer>
  );
}

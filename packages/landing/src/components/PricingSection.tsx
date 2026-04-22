const installPaths = [
  "GitHub Releases for the newest signed desktop build",
  "GitHub-backed Homebrew tap for repeatable installs",
  "Source build from this repo when you need local development",
];

const nextSteps = [
  "Use aroido.com for the current product story and fit guidance",
  "Use this repo for source builds, docs, and issue tracking",
  "Expect prerelease labels until the GA channel is announced",
];

export function PricingSection() {
  const CheckIcon = () => (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m5 12 5 5 9-9" />
    </svg>
  );

  return (
    <section id="pricing" className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center text-slate-50 mb-12">
          Current Paths
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700">
            <h3 className="text-2xl font-semibold text-slate-50 mb-2">Install</h3>
            <div className="text-lg font-semibold text-cyan-400 mb-4">Public channels</div>
            <ul className="space-y-2">
              {installPaths.map((feature) => (
                <li key={feature} className="text-slate-400 flex items-center gap-2">
                  <span className="text-cyan-400" aria-hidden>
                    <CheckIcon />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-6 rounded-xl bg-slate-800/50 border-2 border-cyan-500/50 relative">
            <span className="absolute -top-3 right-6 px-3 py-1 text-xs font-medium bg-cyan-500 text-slate-900 rounded-full">
              Companion
            </span>
            <h3 className="text-2xl font-semibold text-slate-50 mb-2">What this page is for</h3>
            <div className="text-lg font-semibold text-cyan-400 mb-4">Source + docs companion</div>
            <ul className="space-y-2">
              {nextSteps.map((feature) => (
                <li key={feature} className="text-slate-400 flex items-center gap-2">
                  <span className="text-cyan-400" aria-hidden>
                    <CheckIcon />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

import type { ReactNode } from "react";

const features: Array<{
  title: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    title: "Skills Management",
    description: "Organize and manage all your AI agent skills",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
      </svg>
    ),
  },
  {
    title: "Dependency Visualization",
    description: "See relationships between components",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 13a5 5 0 0 1 0-7l2-2a5 5 0 0 1 7 7l-1 1" />
        <path d="M14 11a5 5 0 0 1 0 7l-2 2a5 5 0 0 1-7-7l1-1" />
      </svg>
    ),
  },
  {
    title: "Multi-Platform",
    description: "Works with both Cursor and Claude Code",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3c4 0 7 3 7 7 0 5-4 8-7 11-3-3-7-6-7-11 0-4 3-7 7-7z" />
        <circle cx="12" cy="10" r="2" />
      </svg>
    ),
  },
  {
    title: "Release Guidance",
    description: "Follow the official install and release path from Aroido and GitHub",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 19a6 6 0 0 1 12 0" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M14 19a5 5 0 0 1 7 0" />
      </svg>
    ),
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 px-6 bg-slate-900/50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center text-slate-50 mb-12">
          Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-cyan-500/50 transition-colors"
            >
              <div className="mb-4 text-cyan-400">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-slate-50 mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

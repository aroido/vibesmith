/**
 * Loading Skeleton Components
 * Placeholder UI while data is loading
 */

export function StatsCardSkeleton() {
  return (
    <div className="relative h-full min-h-[12.5rem] overflow-hidden rounded-2xl border border-theme bg-theme-surface p-6 backdrop-blur-md">
      <div className="absolute inset-0 animate-shimmer bg-theme-shimmer bg-[length:200%_100%]" aria-hidden />
      <div className="animate-pulse relative">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-theme-skeleton rounded w-20" />
          <div className="h-8 w-8 bg-theme-skeleton rounded" />
        </div>
        <div className="h-10 bg-theme-skeleton rounded w-16 mb-2" />
        <div className="h-4 bg-theme-skeleton rounded w-24 mb-3" />
        <div className="h-2 bg-theme-skeleton rounded-full" />
      </div>
    </div>
  );
}

export function ActivityItemSkeleton() {
  return (
    <div className="px-4 py-3 border-b border-theme">
      <div className="animate-pulse flex items-center gap-3">
        <div className="h-4 w-4 bg-theme-skeleton rounded" />
        <div className="h-6 w-6 bg-theme-skeleton rounded" />
        <div className="h-4 bg-theme-skeleton rounded w-32" />
        <div className="h-5 bg-theme-skeleton rounded w-16" />
        <div className="flex-1" />
        <div className="h-4 bg-theme-skeleton rounded w-16" />
      </div>
    </div>
  );
}

export function ProjectBarSkeleton() {
  return (
    <div className="mb-4 p-4 rounded-lg bg-theme-surface/40 backdrop-blur-sm border border-theme">
      <div className="animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-6 bg-theme-skeleton rounded w-40" />
          <div className="flex items-center gap-4">
            <div className="h-8 bg-theme-skeleton rounded w-16" />
            <div className="h-6 bg-theme-skeleton rounded w-12" />
          </div>
        </div>
        <div className="h-3 bg-theme-skeleton rounded-full mb-2" />
        <div className="flex items-center gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3 bg-theme-skeleton rounded w-16" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="p-6 rounded-xl bg-theme-surface backdrop-blur-md border border-theme">
      <div className="animate-pulse">
        <div className="h-6 bg-theme-skeleton rounded w-48 mb-4" />
        <div className="flex items-center gap-6">
          <div className="w-40 h-40 bg-theme-skeleton rounded-full" />
          <div className="flex-1 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-4 bg-theme-skeleton rounded w-24" />
                <div className="h-4 bg-theme-skeleton rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

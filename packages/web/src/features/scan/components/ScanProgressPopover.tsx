import { CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { PopoverContent } from '@/components/ui/popover';
import type { ScanProgressProject } from '@/common/api/resources/scanProgress';

interface ScanProgressPopoverProps {
  scanning: boolean;
  projects: ScanProgressProject[];
}

function StatusIcon({ status }: { status: ScanProgressProject['status'] }) {
  switch (status) {
    case 'scanning':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-primary)]" />;
    case 'done':
      return <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-state-success)]" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />;
  }
}

function progressPercent(status: ScanProgressProject['status']) {
  switch (status) {
    case 'done':
      return 100;
    case 'scanning':
      return 50;
    default:
      return 0;
  }
}

function barColor(status: ScanProgressProject['status']) {
  switch (status) {
    case 'done':
      return 'bg-[var(--color-state-success)]';
    case 'scanning':
      return 'bg-[var(--color-primary)]';
    default:
      return 'bg-[var(--color-text-muted)]';
  }
}

export function ScanProgressPopover({
  scanning,
  projects,
}: ScanProgressPopoverProps) {
  const doneCount = projects.filter((p) => p.status === 'done').length;
  const totalCount = projects.length;
  const overallProgress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <PopoverContent align="end" className="w-96 p-0">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {scanning && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-primary)] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-primary)]" />
              </span>
            )}
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Scan Progress
            </p>
          </div>
          <span className="rounded-full bg-[var(--color-bg-hover)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
            {doneCount}/{totalCount}
          </span>
        </div>
      </div>

      {totalCount > 0 && (
        <div className="p-3">
          {/* Progress bar */}
          <div className="mb-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span>Overall</span>
              <span className="font-mono">{overallProgress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-hover)]">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-500 ease-out"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {/* Project list */}
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--color-surface-hover)]"
              >
                <div className="mt-0.5 shrink-0">
                  <StatusIcon status={project.status} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {(project.path || project.name).replace(/\/+$/, '').split('/').pop()}
                  </span>
                  <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]" title={project.path || project.name}>
                    {project.path || project.name}
                  </p>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--color-bg-hover)]">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${barColor(project.status)}`}
                      style={{ width: `${progressPercent(project.status)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalCount === 0 && !scanning && (
        <div className="px-4 py-8 text-center">
          <Clock className="mx-auto mb-2 h-5 w-5 text-[var(--color-text-muted)]" />
          <p className="text-sm text-[var(--color-text-tertiary)]">
            No scan data available.
          </p>
        </div>
      )}
    </PopoverContent>
  );
}

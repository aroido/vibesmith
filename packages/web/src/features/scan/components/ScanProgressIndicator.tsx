import { Loader2, Radio } from 'lucide-react';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { useScanProgress } from '../hooks/useScanProgress';
import { ScanProgressPopover } from './ScanProgressPopover';

export function ScanProgressIndicator() {
  const { isScanning, projects } = useScanProgress();

  if (!isScanning && projects.length === 0) return null;

  const allDone = projects.length > 0 && projects.every((p) => p.status === 'done');
  const iconColor = allDone
    ? 'text-[var(--color-state-success)]'
    : 'text-[var(--color-state-danger)]';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
          aria-label={isScanning ? 'Scan in progress' : 'View scan results'}
        >
          {isScanning ? (
            <Loader2 className={`h-4 w-4 animate-spin ${iconColor}`} />
          ) : (
            <Radio className={`h-4 w-4 ${iconColor}`} />
          )}
        </button>
      </PopoverTrigger>
      <ScanProgressPopover scanning={isScanning} projects={projects} />
    </Popover>
  );
}

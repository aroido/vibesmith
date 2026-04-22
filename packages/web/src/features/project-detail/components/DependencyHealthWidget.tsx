import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { GitBranch, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/common/api';

interface GraphData {
  nodes: { id: string }[];
  edges: { source: string; target: string; is_broken: boolean }[];
  cycles: string[][];
}

interface DependencyHealthWidgetProps {
  projectId: string;
}

interface GaugeProps {
  label: string;
  value: string;
  percentage: number;
  tone: string;
}

function Gauge({ label, value, percentage, tone }: GaugeProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-theme-secondary">{label}</span>
        <span
          className="text-xs font-semibold font-mono tabular-nums text-[var(--gauge-tone)]"
          style={{ ['--gauge-tone' as string]: tone }}
        >
          {value}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-theme-hover overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--gauge-tone)] transition-all duration-500"
          style={{ width: `${percentage}%`, ['--gauge-tone' as string]: tone }}
        />
      </div>
    </div>
  );
}

export function DependencyHealthWidget({ projectId }: DependencyHealthWidgetProps) {
  const { t } = useTranslation('projectDetail');

  const { data, isLoading } = useQuery({
    queryKey: ['dependency-health', projectId],
    queryFn: () => apiClient<GraphData>(`/api/dependencies?project_id=${projectId}`),
    staleTime: 30_000,
  });

  const gauges = useMemo(() => {
    if (!data) return null;

    const totalEdges = data.edges.length;
    const brokenCount = data.edges.filter((e) => e.is_broken).length;
    const cycleCount = data.cycles.length;
    const healthyCount = totalEdges - brokenCount;

    const healthPct = totalEdges > 0 ? Math.round((healthyCount / totalEdges) * 100) : 100;
    // Invert: 0 issues = 100% bar, more issues = lower bar
    const cyclePct = totalEdges > 0 ? Math.max(0, 100 - cycleCount * 20) : 100;
    const brokenPct = totalEdges > 0 ? Math.max(0, Math.round(((totalEdges - brokenCount) / totalEdges) * 100)) : 100;

    return { totalEdges, healthyCount, brokenCount, cycleCount, healthPct, cyclePct, brokenPct };
  }, [data]);

  if (isLoading) {
    return (
      <div className="w-[200px] shrink-0 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-theme-surface/40" />
        ))}
      </div>
    );
  }

  if (!gauges || gauges.totalEdges === 0) return null;

  const healthColor = gauges.healthPct >= 90
    ? 'var(--color-state-success)'
    : gauges.healthPct >= 70
      ? 'var(--color-state-warning)'
      : 'var(--color-state-danger)';

  const cycleColor = gauges.cycleCount === 0
    ? 'var(--color-state-success)'
    : gauges.cycleCount <= 2
      ? 'var(--color-state-warning)'
      : 'var(--color-state-danger)';

  const brokenColor = gauges.brokenCount === 0
    ? 'var(--color-state-success)'
    : gauges.brokenCount <= 2
      ? 'var(--color-state-warning)'
      : 'var(--color-state-danger)';

  return (
    <div className="w-[200px] shrink-0 space-y-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <GitBranch className="h-3.5 w-3.5 text-theme-tertiary" aria-hidden />
        <span className="text-xs font-medium text-theme-tertiary">
          {t('depHealth.title')}
        </span>
      </div>

      <Gauge
        label={t('depHealth.overallLabel')}
        value={`${gauges.healthPct}%`}
        percentage={gauges.healthPct}
        tone={healthColor}
      />
      <Gauge
        label={t('depHealth.cyclesLabel')}
        value={String(gauges.cycleCount)}
        percentage={gauges.cyclePct}
        tone={cycleColor}
      />
      <Gauge
        label={t('depHealth.brokenLabel')}
        value={String(gauges.brokenCount)}
        percentage={gauges.brokenPct}
        tone={brokenColor}
      />

      <Link
        to={`/dependencies?project=${projectId}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
      >
        {t('depHealth.viewGraph')}
        <ArrowRight className="h-3 w-3" aria-hidden />
      </Link>
    </div>
  );
}

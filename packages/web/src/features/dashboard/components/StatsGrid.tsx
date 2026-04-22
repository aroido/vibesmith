/**
 * Stats Grid - 6 cards: Skills, Agents, Commands, Hooks, Rules, Active/Sleep
 * Spec §5.3, §5.4
 */

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  CheckCircle2,
  FileText,
  Link2,
  Sparkles,
  TerminalSquare,
} from 'lucide-react';
import type { DashboardStats } from '../types';
import { StatsCard } from './StatsCard';
import { StatsCardSkeleton } from './LoadingSkeleton';

interface StatsGridProps {
  stats: DashboardStats | null | undefined;
  isLoading: boolean;
}

export function StatsGrid({ stats, isLoading }: StatsGridProps) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <section
        aria-label={t('stats.statsAria')}
        className="grid grid-cols-1 auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </section>
    );
  }

  if (!stats) return null;

  const totalCount = stats.totalCount || 1;

  return (
    <section
      aria-label={t('stats.statsAria')}
      className="grid grid-cols-1 auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6"
      data-testid="stats-grid"
    >
      <StatsCard
        title={t('stats.skills')}
        value={stats.totalSkills}
        trend={stats.trends.skills}
        icon={<Sparkles className="h-5 w-5" />}
        color="cyan"
        progress={Math.floor((stats.totalSkills / totalCount) * 100)}
        onClick={() => void navigate('/components?type=skill')}
        data-testid="dashboard-stats-skill-button"
      />
      <StatsCard
        title={t('stats.agents')}
        value={stats.totalAgents}
        trend={stats.trends.agents}
        icon={<Bot className="h-5 w-5" />}
        color="purple"
        progress={Math.floor((stats.totalAgents / totalCount) * 100)}
        onClick={() => void navigate('/components?type=subagent')}
        data-testid="dashboard-stats-agent-button"
      />
      <StatsCard
        title={t('stats.commands')}
        value={stats.totalCommands}
        trend={stats.trends.commands}
        icon={<TerminalSquare className="h-5 w-5" />}
        color="green"
        progress={Math.floor((stats.totalCommands / totalCount) * 100)}
        onClick={() => void navigate('/components?type=command')}
        data-testid="dashboard-stats-command-button"
      />
      <StatsCard
        title={t('stats.hooks')}
        value={stats.totalHooks}
        trend={stats.trends.hooks}
        icon={<Link2 className="h-5 w-5" />}
        color="orange"
        progress={Math.floor((stats.totalHooks / totalCount) * 100)}
        onClick={() => void navigate('/components?type=hook')}
        data-testid="dashboard-stats-hook-button"
      />
      <StatsCard
        title={t('stats.rules')}
        value={stats.totalRules}
        trend={stats.trends.rules}
        icon={<FileText className="h-5 w-5" />}
        color="blue"
        progress={Math.floor((stats.totalRules / totalCount) * 100)}
        onClick={() => void navigate('/components?type=rule')}
        data-testid="dashboard-stats-rule-button"
      />
      <StatsCard
        title={t('stats.activeSleep')}
        value={stats.activeCount}
        icon={<CheckCircle2 className="h-5 w-5" />}
        color="white"
        progress={Math.floor((stats.activeCount / totalCount) * 100)}
        onClick={() => void navigate('/components?status=active')}
        secondaryValue={stats.inactiveCount}
        secondaryLabel={t('stats.sleep')}
        data-testid="dashboard-stats-active-button"
      />
    </section>
  );
}

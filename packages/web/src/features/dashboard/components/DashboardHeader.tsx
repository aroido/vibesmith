/**
 * Dashboard Header - reuses common app header with project selector
 */

import { AppHeader } from '@/components/common';
import { ProjectSelector } from './ProjectSelector';
import type { Project } from '../types';

interface DashboardHeaderProps {
  projects?: Project[];
  selectedProjectId: string | null;
  onProjectChange: (id: string | null) => void;
}

export function DashboardHeader({
  projects,
  selectedProjectId,
  onProjectChange,
}: DashboardHeaderProps) {
  return (
    <AppHeader
      activeNav="home"
      logoExtra={
        projects && projects.length > 0 ? (
          <ProjectSelector
            projects={projects}
            currentProjectId={selectedProjectId}
            onProjectChange={(id) =>
              onProjectChange(id === 'all' ? null : id)
            }
          />
        ) : undefined
      }
    />
  );
}

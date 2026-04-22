/**
 * Project Filter Component
 * Allows filtering components by project
 */

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getProjects } from '../services/api';

interface ProjectFilterProps {
  selectedProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
}

export function ProjectFilter({
  selectedProjectId,
  onProjectChange,
}: ProjectFilterProps) {
  const { t } = useTranslation('components');
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    staleTime: 60 * 1000, // 1분
  });

  return (
    <div className="space-y-2">
      <label
        htmlFor="project-filter"
        className="block text-sm font-medium text-theme-secondary"
      >
        {t('list.projectLabel')}
      </label>
      <select
        id="project-filter"
        value={selectedProjectId ?? 'all'}
        onChange={(e) =>
          onProjectChange(e.target.value === 'all' ? null : e.target.value)
        }
        disabled={isLoading}
        className="w-full h-12 px-4 rounded-lg input-theme disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={t('list.projectFilterAria')}
      >
        <option value="all">{t('list.projectAll')}</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
            {project.is_global ? t('list.projectGlobal') : ''}
            {' - '}
            {t('list.projectCount', { count: project.component_count })}
          </option>
        ))}
      </select>
    </div>
  );
}

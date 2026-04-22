/**
 * Project selector dropdown
 * Select project for new component (spec §5.3)
 */

import { useTranslation } from 'react-i18next';
import type { Project } from '@/common/types';

interface ProjectSelectorProps {
  selectedProjectId: string;
  projects: Project[];
  isLoading?: boolean;
  onProjectChange: (projectId: string) => void;
}

export function ProjectSelector({
  selectedProjectId,
  projects,
  isLoading = false,
  onProjectChange,
}: ProjectSelectorProps) {
  const { t } = useTranslation('components');

  return (
    <div className="space-y-2">
      <label
        htmlFor="project-select"
        className="block text-sm font-medium text-theme-primary"
      >
        {t('list.project')} <span className="text-theme-danger">*</span>
      </label>
      <select
        id="project-select"
        value={selectedProjectId}
        onChange={(e) => onProjectChange(e.target.value)}
        disabled={isLoading}
        aria-label={t('create.projectSelectAria')}
        aria-required="true"
        className="w-full px-4 py-2 rounded-lg input-theme disabled:opacity-50"
      >
        <option value="" disabled>
          {isLoading ? t('create.loading') : t('create.projectSelectAria')}
        </option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.is_global ? t('list.projectGlobal') : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

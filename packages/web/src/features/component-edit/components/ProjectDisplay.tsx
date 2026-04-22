/**
 * Project Display
 * 읽기 전용 - 프로젝트 이름 표시
 */

import { useTranslation } from 'react-i18next';

interface ProjectDisplayProps {
  projectName: string;
}

export function ProjectDisplay({ projectName }: ProjectDisplayProps) {
  const { t } = useTranslation('components');
  return (
    <div className="vs-frost-panel rounded-xl p-6">
      <h2 className="text-lg font-semibold text-theme-primary mb-4">{t('edit.project')}</h2>
      <p className="font-mono text-primary">{projectName}</p>
    </div>
  );
}

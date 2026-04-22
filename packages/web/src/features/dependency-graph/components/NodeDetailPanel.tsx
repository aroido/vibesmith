import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { useDependencyDetail } from '../hooks/useDependencyDetail';

interface NodeDetailPanelProps {
  nodeId: string;
  onClose: () => void;
  onNodeSelect: (nodeId: string) => void;
}

export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({
  nodeId,
  onClose,
  onNodeSelect,
}) => {
  const { t } = useTranslation('dependencyGraph');
  const navigate = useNavigate();
  const { data, isLoading, error } = useDependencyDetail(nodeId);

  if (isLoading) {
    return (
      <div className="h-full w-full vs-frost-panel rounded-xl text-theme-primary p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{t('panel.loading')}</h3>
          <button
            onClick={onClose}
            className="text-theme-secondary hover:text-theme-primary"
            aria-label={t('panel.closeAria')}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-full w-full vs-frost-panel rounded-xl text-theme-primary p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-theme-danger">{t('panel.error')}</h3>
          <button
            onClick={onClose}
            className="text-theme-secondary hover:text-theme-primary"
            aria-label={t('panel.closeAria')}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="text-sm text-theme-secondary">{t('panel.loadDetailError')}</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full vs-frost-panel rounded-xl text-theme-primary p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-theme-primary">{t('panel.componentDetails')}</h3>
        <button
          onClick={onClose}
          className="text-theme-secondary hover:text-theme-primary"
          aria-label={t('panel.closeAria')}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-theme-secondary mb-2">
            {t('panel.dependsOn', { count: data.depends_on.length })}
          </h4>
          {data.depends_on.length === 0 ? (
            <p className="text-sm text-theme-secondary">{t('panel.noDependencies')}</p>
          ) : (
            <ul className="space-y-2">
              {data.depends_on.map((dep) => (
                <li key={dep.id}>
                  <button
                    onClick={() => onNodeSelect(dep.id)}
                    className={`text-sm text-left w-full p-2 rounded hover:bg-theme-hover ${
                      dep.is_broken ? 'text-theme-danger' : 'text-primary'
                    }`}
                  >
                    • {dep.name} ({dep.type})
                    {dep.is_broken && (
                      <span className="ml-1 inline-flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                        {t('panel.broken')}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="text-sm font-medium text-theme-secondary mb-2">
            {t('panel.dependedBy', { count: data.depended_by.length })}
          </h4>
          {data.depended_by.length === 0 ? (
            <p className="text-sm text-theme-secondary">{t('panel.noDependents')}</p>
          ) : (
            <ul className="space-y-2">
              {data.depended_by.map((dep) => (
                <li key={dep.id}>
                  <button
                    onClick={() => onNodeSelect(dep.id)}
                    className="text-sm text-primary text-left w-full p-2 rounded hover:bg-theme-hover"
                  >
                    • {dep.name} ({dep.type})
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pt-4 border-t border-theme">
          <button
            type="button"
            onClick={() => {
              navigate(`/components/${nodeId}`);
            }}
            className="block w-full px-4 py-2 btn-theme-primary-soft text-sm font-medium rounded-md text-center"
          >
            {t('panel.viewDetails')}
          </button>
        </div>
      </div>
    </div>
  );
};

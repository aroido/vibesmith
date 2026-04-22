/**
 * Omnibox Component (Cmd+K)
 * Issue #69: 통합 검색 및 빠른 액션
 * 
 * Based on: cmdk (Vercel)
 * UX Reference: Raycast, Spotlight
 */

import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Command } from 'cmdk';
import {
  FileText,
  Settings,
  Search,
  Plus,
  Layers,
  Zap,
  FolderOpen,
  Home,
  List,
  Trash2,
  Moon,
  Sun,
  Languages,
} from 'lucide-react';
import { ANALYTICS_MASK_TEXT_CLASS } from '@/common/analytics/privacy';
import { ComponentIcon } from '@/components/common';
import { useOmnibox } from '../hooks/useOmnibox';
import { useSearchHistory } from '../../global-search/hooks/useSearchHistory';
import { highlightMatches } from '../../global-search/services/fuzzySearch';
import { trackFirstValueOnce } from '@/common/analytics/activation';
import { trackFeatureUsed } from '@/common/analytics/desktopAnalyticsBridge';
import { useTheme } from '@/hooks/useTheme';
import './omnibox.css';

interface OmniboxProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Omnibox({ isOpen, onClose }: OmniboxProps) {
  const { t, i18n } = useTranslation(['omnibox', 'globalSearch']);
  const navigate = useNavigate();
  const { setTheme, resolvedTheme } = useTheme();
  const {
    query,
    setQuery,
    componentResults,
    projectResults,
    loading,
  } = useOmnibox();
  
  const { recentSearches, addSearch } = useSearchHistory();
  const openTrackedRef = useRef(false);
  const lastExecutedSignatureRef = useRef<string | null>(null);

  // 빠른 액션 정의
  const quickActions = [
    {
      id: 'go-home',
      label: t('omnibox:actions.goHome'),
      icon: <Home size={18} />,
      keywords: ['home', 'dashboard', '홈', '대시보드'],
      action: () => {
        void navigate('/');
      },
    },
    {
      id: 'view-projects',
      label: t('omnibox:actions.viewProjects'),
      icon: <FolderOpen size={18} />,
      keywords: ['projects', 'workspace', '프로젝트', '워크스페이스'],
      action: () => {
        void navigate('/projects');
      },
    },
    {
      id: 'view-components',
      label: t('omnibox:actions.viewComponents'),
      icon: <List size={18} />,
      keywords: ['components', 'list', 'all', '구성요소', '목록', '전체'],
      action: () => {
        void navigate('/components');
      },
    },
    {
      id: 'create-component',
      label: t('omnibox:actions.createComponent'),
      icon: <Plus size={18} />,
      keywords: ['create', 'new', 'skill', 'agent', '생성', '만들기', '추가'],
      action: () => {
        void navigate('/components/create');
      },
    },
    {
      id: 'view-dependencies',
      label: t('omnibox:actions.viewDependencies'),
      icon: <Layers size={18} />,
      keywords: ['dependencies', 'graph', 'relationships', '종속성', '그래프', '의존성'],
      action: () => {
        void navigate('/components/dependencies');
      },
    },
    {
      id: 'view-trash',
      label: t('omnibox:actions.viewTrash'),
      icon: <Trash2 size={18} />,
      keywords: ['trash', 'deleted', 'recycle', '휴지통', '삭제됨', '복원'],
      action: () => {
        void navigate('/settings/data/trash');
      },
    },
    {
      id: 'open-settings',
      label: t('omnibox:actions.openSettings'),
      icon: <Settings size={18} />,
      keywords: ['settings', 'config', 'preferences', '설정', '환경설정', '구성'],
      action: () => {
        void navigate('/settings');
      },
    },
    {
      id: 'toggle-theme',
      label: t('omnibox:actions.toggleTheme', {
        theme: resolvedTheme === 'dark' ? t('omnibox:theme.light') : t('omnibox:theme.dark'),
      }),
      icon: resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />,
      keywords: ['theme', 'dark', 'light', 'mode', '테마', '다크', '라이트', '모드'],
      action: () => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
      },
    },
    {
      id: 'toggle-language',
      label: t('omnibox:actions.toggleLanguage', {
        lang: i18n.language === 'ko' ? 'English' : '한국어',
      }),
      icon: <Languages size={18} />,
      keywords: ['language', 'locale', 'english', 'korean', '언어', '영어', '한국어'],
      action: () => {
        void i18n.changeLanguage(i18n.language === 'ko' ? 'en' : 'ko');
      },
    },
  ];

  // 컴포넌트 선택
  const handleSelectComponent = useCallback((componentId: string) => {
    trackFeatureUsed('global_search', {
      action: 'result_select',
      result: 'success',
      source: 'component',
      query_length: query.trim().length || null,
    });
    trackFirstValueOnce('global_search_result_select', {
      result_source: 'component',
    });
    if (query.trim()) addSearch(query);
    void navigate(`/components/${componentId}`);
    onClose();
  }, [query, addSearch, navigate, onClose]);

  // 프로젝트 선택
  const handleSelectProject = useCallback((projectId: string) => {
    trackFeatureUsed('global_search', {
      action: 'result_select',
      result: 'success',
      source: 'project',
      query_length: query.trim().length || null,
    });
    trackFirstValueOnce('global_search_result_select', {
      result_source: 'project',
    });
    if (query.trim()) addSearch(query);
    void navigate(`/projects/${projectId}`);
    onClose();
  }, [query, addSearch, navigate, onClose]);

  // 액션 실행
  const handleSelectAction = useCallback((actionId: string, action: () => void) => {
    trackFeatureUsed('global_search', {
      action: 'quick_action',
      result: 'success',
      source: actionId,
      query_length: query.trim().length || null,
    });
    if (query.trim()) addSearch(query);
    action();
    onClose();
  }, [query, addSearch, onClose]);

  useEffect(() => {
    if (!isOpen) {
      openTrackedRef.current = false;
      return;
    }

    if (openTrackedRef.current) {
      return;
    }

    openTrackedRef.current = true;
    trackFeatureUsed('global_search', {
      action: 'open',
      source: 'omnibox',
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || loading) {
      return;
    }

    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      lastExecutedSignatureRef.current = null;
      return;
    }

    const resultCount = componentResults.length + projectResults.length;
    const signature = `${normalizedQuery.length}:${resultCount}`;
    if (lastExecutedSignatureRef.current === signature) {
      return;
    }

    lastExecutedSignatureRef.current = signature;
    trackFeatureUsed('global_search', {
      action: 'execute',
      result: resultCount > 0 ? 'results' : 'empty',
      query_length: normalizedQuery.length,
      result_count: resultCount,
    });
  }, [componentResults.length, isOpen, loading, projectResults.length, query]);

  // Esc 키로 닫기 & Body 스크롤 방지
  useEffect(() => {
    if (!isOpen) return;
    
    // Body 스크롤 방지
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEsc);
    
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  // 포커스 트랩 (Tab 키 제어)
  useEffect(() => {
    if (!isOpen) return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      // Omnibox 내부에서는 cmdk가 자체적으로 포커스를 관리하므로
      // Tab 키를 방지하여 외부로 포커스가 나가지 않도록 함
      e.preventDefault();
    };

    window.addEventListener('keydown', handleTab);
    return () => window.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  if (!isOpen) return null;

  // 총 결과 개수 계산
  const totalResults = componentResults.length + projectResults.length;
  const hasResults = totalResults > 0;

  return (
    <div 
      className="omnibox-overlay" 
      role="dialog" 
      aria-modal="true"
      aria-labelledby="omnibox-title"
      aria-describedby="omnibox-description"
    >
      <div 
        className="omnibox-backdrop" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      <Command className="omnibox-container" label={t('omnibox:ariaLabel')}>
        <div className="omnibox-header">
          <Search size={20} className="omnibox-search-icon" aria-hidden="true" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder={t('omnibox:placeholder')}
            className="omnibox-input"
            aria-label={t('omnibox:ariaInputLabel')}
            id="omnibox-title"
          />
          <kbd className="omnibox-kbd" aria-hidden="true">Esc</kbd>
        </div>

        {/* 스크린 리더용 상태 안내 */}
        <div 
          className="sr-only" 
          role="status" 
          aria-live="polite" 
          aria-atomic="true"
          id="omnibox-description"
        >
          {loading && t('omnibox:ariaLoading')}
          {!loading && query && hasResults && t('omnibox:ariaResultsFound', { count: totalResults })}
          {!loading && query && !hasResults && t('omnibox:ariaNoResults')}
          {!query && t('omnibox:ariaNoQuery')}
        </div>

        <Command.List className="omnibox-list">
          <Command.Empty className="omnibox-empty">
            {loading ? t('omnibox:loading') : t('omnibox:noResults')}
          </Command.Empty>

          {/* Quick Actions */}
          {!query && (
            <Command.Group heading={t('omnibox:groups.quickActions')} className="omnibox-group">
              {quickActions.map((action) => (
                <Command.Item
                  key={action.id}
                  value={`action-${action.id}`}
                  keywords={action.keywords}
                  onSelect={() => handleSelectAction(action.id, action.action)}
                  className="omnibox-item"
                >
                  <div className="omnibox-item-icon">{action.icon}</div>
                  <span className="omnibox-item-label">{action.label}</span>
                  <Zap size={14} className="omnibox-item-badge" />
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Recent Searches */}
          {!query && recentSearches.length > 0 && (
            <Command.Group heading={t('globalSearch:recentSearches')} className="omnibox-group">
              {recentSearches.slice(0, 5).map((recentQuery) => (
                <Command.Item
                  key={`recent-${recentQuery}`}
                  value={`recent-${recentQuery}`}
                  onSelect={() => setQuery(recentQuery)}
                  className="omnibox-item"
                >
                  <Search size={18} className="omnibox-item-icon" />
                  <span className="omnibox-item-label">{recentQuery}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Components */}
          {componentResults.length > 0 && (
            <Command.Group heading={t('omnibox:groups.components')} className="omnibox-group">
              {componentResults.slice(0, 8).map((result) => (
                <Command.Item
                  key={result.id}
                  value={`component-${result.id}-${result.name}`}
                  keywords={[result.name, result.type, ...(result.tags || [])]}
                  onSelect={() => handleSelectComponent(result.id)}
                  className="omnibox-item"
                >
                  <ComponentIcon type={result.type} />
                  <div className="omnibox-item-content">
                    <div className="omnibox-item-title">
                      <span
                        dangerouslySetInnerHTML={{
                          __html: result.matches?.name
                            ? highlightMatches(result.name, result.matches.name)
                            : result.name,
                        }}
                      />
                      <span
                        className={`omnibox-item-status ${
                          result.enabled ? 'active' : 'inactive'
                        }`}
                      >
                        {result.enabled ? t('globalSearch:active') : t('globalSearch:inactive')}
                      </span>
                    </div>
                    {result.description && (
                      <p
                        className="omnibox-item-description"
                        dangerouslySetInnerHTML={{
                          __html: result.matches?.description
                            ? highlightMatches(result.description, result.matches.description)
                            : result.description,
                        }}
                      />
                    )}
                    <div className="omnibox-item-meta">
                      <span>{result.type}</span>
                      <span>•</span>
                      <span>{result.project_id}</span>
                      <span>•</span>
                      <span>
                        {new Date(result.updated_at).toLocaleDateString(
                          i18n.language === 'ko' ? 'ko-KR' : 'en-US',
                          { month: 'short', day: 'numeric' }
                        )}
                      </span>
                    </div>
                  </div>
                  <FileText size={14} className="omnibox-item-trailing" />
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Projects */}
          {projectResults.length > 0 && (
            <Command.Group heading={t('omnibox:groups.projects')} className="omnibox-group">
              {projectResults.slice(0, 5).map((project) => (
                <Command.Item
                  key={project.id}
                  value={`project-${project.id}-${project.name}`}
                  keywords={[project.name, project.path]}
                  onSelect={() => handleSelectProject(project.id)}
                  className="omnibox-item"
                >
                  <FolderOpen size={18} className="omnibox-item-icon" />
                  <div className="omnibox-item-content">
                    <div className="omnibox-item-title">
                      <span>{project.name}</span>
                      <span className="omnibox-item-count">
                        {project.component_count} {t('omnibox:components')}
                      </span>
                    </div>
                    <p
                      className={`omnibox-item-description ${ANALYTICS_MASK_TEXT_CLASS}`}
                    >
                      {project.path}
                    </p>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>

        {/* Footer */}
        <div className="omnibox-footer">
          <div className="omnibox-footer-hint">
            <kbd>↑↓</kbd>
            <span>{t('globalSearch:navigate')}</span>
          </div>
          <span className="omnibox-footer-separator">•</span>
          <div className="omnibox-footer-hint">
            <kbd>↵</kbd>
            <span>{t('globalSearch:select')}</span>
          </div>
          <span className="omnibox-footer-separator">•</span>
          <div className="omnibox-footer-hint">
            <kbd>Esc</kbd>
            <span>{t('globalSearch:close')}</span>
          </div>
        </div>
      </Command>
    </div>
  );
}

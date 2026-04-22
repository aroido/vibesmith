import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWizard } from 'react-use-wizard';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { saveComponent, getProjects } from '../../services/api';
import { showSuccessToast, showErrorToast } from '@/common/utils';
import type { WizardFormData, ComponentSaveRequest } from '../../types';
import { buildComponentFilePath, isHookType } from '../../utils/path-preview';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface SaveStepProps {
  formData: WizardFormData;
  onComplete: (componentId: string) => void;
}

export const SaveStep: React.FC<SaveStepProps> = ({ formData, onComplete }) => {
  const { t } = useTranslation('components');
  const { handleStep } = useWizard();

  const getPlatformLabel = (platform: string) => {
    if (platform === 'claude_code') return t('wizard.platformClaudeCode');
    if (platform === 'cursor') return t('wizard.platformCursor');
    return platform;
  };
  const navigate = useNavigate();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [isSaved, setIsSaved] = useState(false);
  const [savedComponentId, setSavedComponentId] = useState<string | null>(null);

  // 프로젝트 목록 조회
  const {
    data: projects,
    isLoading: isLoadingProjects,
    error: projectsError,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    staleTime: 5 * 60 * 1000, // 5분 캐싱
  });

  // 컴포넌트 저장 mutation
  const saveMutation = useMutation({
    mutationFn: saveComponent,
    onSuccess: (response) => {
      setIsSaved(true);
      setSavedComponentId(response.id);
      showSuccessToast(t('wizard.successToast'));
    },
    onError: (error: Error) => {
      showErrorToast(t('wizard.saveError', { message: error.message }));
    },
  });

  // 프로젝트 선택 시 platform 초기화: 프로젝트의 platforms 기반, 없으면 cursor/claude_code 폴백
  React.useEffect(() => {
    if (!selectedProjectId || !projects) return;

    const project = projects.find((p) => p.id === selectedProjectId);
    const available = project?.platforms?.filter((p) => p === 'claude_code' || p === 'cursor') ?? ['claude_code', 'cursor'];
    const defaultPlatform = available.includes('cursor') ? 'cursor' : available[0] ?? 'cursor';
    setSelectedPlatform(defaultPlatform);
  }, [selectedProjectId, projects]);

  // 저장 완료 후 2초 뒤 자동 닫기
  React.useEffect(() => {
    if (!isSaved || !savedComponentId) return;

    const timer = setTimeout(() => {
      onComplete(savedComponentId);
    }, 2000);

    return () => clearTimeout(timer);
  }, [isSaved, savedComponentId, onComplete]);

  const handleSave = async () => {
    if (!selectedProjectId || !projects) {
      showErrorToast(t('wizard.selectProject'));
      return;
    }

    if (!formData.generatedContent || !formData.componentType || !formData.basicInfo) {
      showErrorToast(t('wizard.noComponentToSave'));
      return;
    }

    // basicInfo에서 name 추출 (타입별 필드명 다를 수 있음)
    const name = 
      (formData.basicInfo.skill_name as string) ||
      (formData.basicInfo.agent_name as string) ||
      (formData.basicInfo.command_name as string) ||
      (formData.basicInfo.hook_name as string) ||
      (formData.basicInfo.rule_name as string) ||
      (formData.basicInfo.name as string) ||
      '';

    if (!name.trim()) {
      showErrorToast(t('wizard.nameRequired'));
      return;
    }

    // tags 파싱 (comma-separated string → array)
    const tagsString = formData.basicInfo.tags as string | undefined;
    const tags = tagsString
      ? tagsString.split(',').map((tag) => tag.trim()).filter(Boolean)
      : [];

    const project = projects.find((p) => p.id === selectedProjectId);
    const availablePlatforms = project?.platforms?.filter((p) => p === 'claude_code' || p === 'cursor') ?? ['claude_code', 'cursor'];
    const resolvedPlatform: 'claude_code' | 'cursor' =
      selectedPlatform === 'claude_code' || selectedPlatform === 'cursor'
        ? selectedPlatform
        : (availablePlatforms.includes('cursor') ? 'cursor' : (availablePlatforms[0] as 'claude_code' | 'cursor') ?? 'cursor');

    const request: ComponentSaveRequest = {
      type: formData.componentType,
      name: name.trim(),
      project_id: selectedProjectId,
      content: formData.generatedContent,
      tags,
      platform: resolvedPlatform,
    };

    saveMutation.mutate(request);
  };

  // 마지막 단계이므로 검증 없음 (handleStep 호출 제거)
  React.useEffect(() => {
    handleStep(() => {
      // No validation needed for last step
    });
  }, [handleStep]);

  // 로딩 상태
  if (isLoadingProjects) {
    return (
      <div className="px-8 py-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-theme-secondary" />
        <span className="ml-2 text-theme-tertiary">{t('wizard.projectsLoading')}</span>
      </div>
    );
  }

  // 에러 상태
  if (projectsError) {
    return (
      <div className="px-8 py-6">
        <div className="alert-theme-danger rounded-lg p-4">
          <AlertCircle className="h-5 w-5 text-theme-danger mb-2" />
          <p className="text-sm text-theme-danger">
            {t('wizard.projectsError', { message: projectsError.message })}
          </p>
        </div>
      </div>
    );
  }

  // 프로젝트 없음
  if (!projects || projects.length === 0) {
    return (
      <div className="px-8 py-6">
        <div className="alert-theme-warning rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-theme-warning mx-auto mb-4" aria-hidden />
          <h4 className="text-lg font-semibold text-theme-warning mb-2">
            {t('wizard.noProjects')}
          </h4>
          <p className="text-sm text-theme-warning mb-4">
            {t('wizard.addProjectFirst')}
          </p>
          <Button
            onClick={() => {
              void navigate('/settings');
            }}
            variant="outline"
            type="button"
            aria-label={t('wizard.goToSettings')}
          >
            {t('wizard.goToSettings')}
          </Button>
        </div>
      </div>
    );
  }

  // 저장 완료 상태
  if (isSaved) {
    return (
      <div className="px-8 py-6">
        <div className="alert-theme-success rounded-lg p-6 text-center" role="status">
          <CheckCircle2 className="h-16 w-16 text-theme-success mx-auto mb-4" aria-hidden />
          <h4 className="text-lg font-semibold text-theme-success mb-2">
            {t('wizard.saveComplete')}
          </h4>
          <p className="text-sm text-theme-success">
            {t('wizard.saveSuccess')}
          </p>
          {saveMutation.data?.enabled && (
            <p className="mt-2 inline-flex items-center gap-1 text-sm text-theme-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {t('wizard.enabledBadge')}
            </p>
          )}
        </div>
        <p className="text-sm text-theme-tertiary text-center mt-4">
          {t('wizard.autoClose')}
        </p>
      </div>
    );
  }

  // 파일 경로 미리보기 (실제 저장 규칙과 동일 - Issue #324)
  const getPathPreview = () => {
    if (!selectedProjectId || !formData.componentType || !formData.basicInfo || !projects) {
      return '';
    }

    const project = projects.find((p) => p.id === selectedProjectId);
    if (!project) return '';

    const name =
      (formData.basicInfo.skill_name as string) ||
      (formData.basicInfo.agent_name as string) ||
      (formData.basicInfo.command_name as string) ||
      (formData.basicInfo.hook_name as string) ||
      (formData.basicInfo.rule_name as string) ||
      (formData.basicInfo.name as string) ||
      '';

    const availablePlatforms =
      project.platforms?.filter((p) => p === 'claude_code' || p === 'cursor') ??
      ['claude_code', 'cursor'];
    const platform: 'claude_code' | 'cursor' =
      selectedPlatform === 'claude_code' || selectedPlatform === 'cursor'
        ? selectedPlatform
        : availablePlatforms.includes('cursor')
          ? 'cursor'
          : (availablePlatforms[0] as 'claude_code' | 'cursor') ?? 'cursor';

    return buildComponentFilePath({
      projectPath: project.path,
      componentType: formData.componentType,
      name: name.trim(),
      platform,
    });
  };

  // 저장 폼
  return (
    <div className="px-8 py-6">
      <h3 className="text-lg font-semibold mb-6">{t('wizard.saveLabel')}</h3>

      <div className="space-y-6">
        {/* 프로젝트 선택 */}
        <div>
          <Label htmlFor="project">{t('wizard.projectLabel')}</Label>
          <Select value={selectedProjectId || ''} onValueChange={setSelectedProjectId}>
            <SelectTrigger id="project" className="mt-2" aria-label={t('wizard.projectPlaceholder')}>
              <SelectValue placeholder={t('wizard.projectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {t('wizard.projectOption', { name: project.name, path: project.path })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 플랫폼 선택 - 프로젝트 선택 후 표시 */}
        {selectedProjectId && (() => {
          const project = projects.find((p) => p.id === selectedProjectId);
          const availablePlatforms = project?.platforms?.filter((p) => p === 'claude_code' || p === 'cursor') ?? ['claude_code', 'cursor'];
          const platforms = [...new Set(availablePlatforms)];

          if (platforms.length <= 1) return null;

          return (
            <div>
              <Label htmlFor="platform">{t('wizard.platformLabel')}</Label>
              <Select value={selectedPlatform || platforms[0]} onValueChange={setSelectedPlatform}>
                <SelectTrigger id="platform" className="mt-2">
                  <SelectValue placeholder={t('wizard.platformPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => (
                    <SelectItem key={p} value={p}>
                      {getPlatformLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })()}

        {/* 파일 경로 미리보기 (실제 저장 규칙과 동일 - Issue #324) */}
        {selectedProjectId && (
          <div>
            <Label>{t('wizard.filePathLabel')}</Label>
            <div className="mt-2 px-3 py-2 bg-theme-elevated border border-theme rounded-md text-sm text-theme-secondary font-mono">
              {getPathPreview()}
            </div>
            <p className="text-xs text-theme-tertiary mt-1">
              {formData.componentType && isHookType(formData.componentType)
                ? t('wizard.pathMerged')
                : t('wizard.pathAutoCreated')}
            </p>
          </div>
        )}

        {/* 활성화 안내 */}
        <div className="alert-theme-info rounded-lg p-3">
          <p className="text-sm text-[var(--color-primary)]">
            ℹ️ {t('wizard.enabledByDefault')}
          </p>
        </div>

        {/* 저장 버튼 */}
        <Button
          onClick={() => void handleSave()}
          className="w-full"
          disabled={saveMutation.isPending || !selectedProjectId}
          type="button"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('wizard.saving')}
            </>
          ) : (
            t('wizard.saveComponent')
          )}
        </Button>
      </div>
    </div>
  );
};

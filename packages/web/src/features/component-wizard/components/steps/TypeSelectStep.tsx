import React from 'react';
import { useTranslation } from 'react-i18next';
import { useWizard } from 'react-use-wizard';
import { BookOpen, Bot, FileText, Link2, TerminalSquare } from 'lucide-react';
import { TypeCard } from '../TypeCard';
import type { ComponentType, WizardFormData } from '../../types';

const COMPONENT_TYPE_KEYS: Record<ComponentType, { title: string; desc: string }> = {
  skill: { title: 'typeSkill', desc: 'typeSkillDesc' },
  agent: { title: 'typeAgent', desc: 'typeAgentDesc' },
  command: { title: 'typeCommand', desc: 'typeCommandDesc' },
  hook: { title: 'typeHook', desc: 'typeHookDesc' },
  rule: { title: 'typeRule', desc: 'typeRuleDesc' },
};

const COMPONENT_TYPES: Array<{ type: ComponentType; icon: React.ReactNode }> = [
  { type: 'skill', icon: <BookOpen className="h-10 w-10" aria-hidden /> },
  { type: 'agent', icon: <Bot className="h-10 w-10" aria-hidden /> },
  { type: 'command', icon: <TerminalSquare className="h-10 w-10" aria-hidden /> },
  { type: 'hook', icon: <Link2 className="h-10 w-10" aria-hidden /> },
  { type: 'rule', icon: <FileText className="h-10 w-10" aria-hidden /> },
];

interface TypeSelectStepProps {
  formData: WizardFormData;
  setComponentType: (type: ComponentType) => void;
}

export const TypeSelectStep: React.FC<TypeSelectStepProps> = ({
  formData,
  setComponentType,
}) => {
  const { t } = useTranslation('components');
  const { handleStep } = useWizard();

  const handleSelectType = (type: ComponentType) => {
    setComponentType(type);
  };

  // 타입 선택 여부 검증
  handleStep(() => {
    if (!formData.componentType) {
      throw new Error(t('wizard.selectTypeValidation'));
    }
  });

  return (
    <div className="px-8 py-6">
      <h3 className="text-lg text-theme-primary mb-2">
        {t('wizard.selectType')}
      </h3>
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-theme-secondary">
          {t('wizard.dontKnowTypes')}
        </p>
        <a
          href="https://docs.vibesmith.io/components"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
          aria-label={t('wizard.viewGuide')}
        >
          {t('wizard.viewGuide')} →
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {COMPONENT_TYPES.map((item) => (
          <TypeCard
            key={item.type}
            type={item.type}
            icon={item.icon}
            title={t(`wizard.${COMPONENT_TYPE_KEYS[item.type].title}`)}
            description={t(`wizard.${COMPONENT_TYPE_KEYS[item.type].desc}`)}
            isSelected={formData.componentType === item.type}
            onSelect={handleSelectType}
          />
        ))}
      </div>
    </div>
  );
};

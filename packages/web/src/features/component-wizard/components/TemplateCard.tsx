import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ComponentIcon } from '@/components/common';
import type { Template } from '../types';

interface TemplateCardProps {
  template: Template;
  isSelected: boolean;
  onSelect: (templateId: string) => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  isSelected,
  onSelect,
}) => {
  const difficultyColor = {
    beginner: 'badge-theme-success',
    intermediate: 'badge-theme-warning',
    advanced: 'badge-theme-danger',
  }[template.difficulty];

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 h-[220px]',
        isSelected && 'border-primary ring-2 ring-primary'
      )}
      onClick={() => onSelect(template.id)}
    >
      <CardHeader className="relative h-full flex flex-col">
        {isSelected && (
          <CheckCircle2 className="absolute top-4 right-4 text-primary" size={24} />
        )}
        <div className="mb-3">
          <ComponentIcon type={template.component_type} />
        </div>
        <CardTitle className="mb-2">{template.name}</CardTitle>
        <CardDescription className="flex-1">{template.description}</CardDescription>
        <div className="flex gap-2 flex-wrap mt-3">
          <Badge className={difficultyColor}>
            {template.difficulty}
          </Badge>
          <Badge variant="secondary">{template.estimated_time}</Badge>
          <Badge variant="outline">{template.category}</Badge>
        </div>
      </CardHeader>
    </Card>
  );
};

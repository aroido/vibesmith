import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComponentType } from '../types';

interface TypeCardProps {
  type: ComponentType;
  icon: React.ReactNode;
  title: string;
  description: string;
  isSelected: boolean;
  onSelect: (type: ComponentType) => void;
}

export const TypeCard: React.FC<TypeCardProps> = ({
  type,
  icon,
  title,
  description,
  isSelected,
  onSelect,
}) => {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 h-[200px]',
        isSelected && 'border-primary ring-2 ring-primary'
      )}
      onClick={() => onSelect(type)}
    >
      <CardHeader className="relative h-full flex flex-col items-center justify-center">
        {isSelected && (
          <CheckCircle2 className="absolute top-4 right-4 text-primary" size={24} />
        )}
        <div className="mb-4 text-theme-secondary">{icon}</div>
        <CardTitle className="text-center">{title}</CardTitle>
        <CardDescription className="text-center">{description}</CardDescription>
      </CardHeader>
    </Card>
  );
};

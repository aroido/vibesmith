/**
 * PopularTags Component
 * v1.12.0 - 인기 태그 컴포넌트
 */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TagBadge } from './TagBadge';
import type { TagStats } from '../types';

interface PopularTagsProps {
  tags: TagStats[];
  maxTags?: number;
  onTagClick?: (tag: string) => void;
}

export function PopularTags({ tags, maxTags = 10, onTagClick }: PopularTagsProps) {
  const { t } = useTranslation('components');
  const navigate = useNavigate();

  const handleTagClick = (tag: string) => {
    if (onTagClick) {
      onTagClick(tag);
    } else {
      // 기본 동작: Component List로 이동
      void navigate(`/components?tags=${encodeURIComponent(tag)}`);
    }
  };

  const displayTags = tags.slice(0, maxTags);

  if (displayTags.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-theme-secondary text-sm">{t('list.noTagsYet')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {displayTags.map((tagStat) => (
        <TagBadge
          key={tagStat.tag}
          tag={tagStat.tag}
          count={tagStat.count}
          onClick={() => handleTagClick(tagStat.tag)}
        />
      ))}
    </div>
  );
}

/**
 * Component List Filters
 * Composes TypeFilter, ProjectFilter, SearchInput, TagFilter, StatusFilter
 */

import { ComponentTypeFilter } from './ComponentTypeFilter';
import { ProjectFilter } from './ProjectFilter';
import { SearchInput } from './SearchInput';
import { TagFilter } from './TagFilter';
import { StatusFilter } from './StatusFilter';
import type { FilterType } from './ComponentTypeFilter';
import type { StatusFilterValue } from './StatusFilter';
import type { TagFilterMode } from './TagFilter';

export interface ComponentListFiltersProps {
  selectedTypes: FilterType[];
  onTypesChange: (types: FilterType[]) => void;
  selectedProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  tagFilterMode: TagFilterMode;
  onTagFilterModeChange: (mode: TagFilterMode) => void;
  statusFilter: StatusFilterValue;
  onStatusFilterChange: (status: StatusFilterValue) => void;
}

export function ComponentListFilters({
  selectedTypes,
  onTypesChange,
  selectedProjectId,
  onProjectChange,
  searchQuery,
  onSearchChange,
  selectedTags,
  onTagsChange,
  tagFilterMode,
  onTagFilterModeChange,
  statusFilter,
  onStatusFilterChange,
}: ComponentListFiltersProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <ComponentTypeFilter selectedTypes={selectedTypes} onTypesChange={onTypesChange} />
      <ProjectFilter selectedProjectId={selectedProjectId} onProjectChange={onProjectChange} />
      <SearchInput value={searchQuery} onChange={onSearchChange} />
      <div className="relative">
        <TagFilter
          selectedTags={selectedTags}
          onTagsChange={onTagsChange}
          tagFilterMode={tagFilterMode}
          onTagFilterModeChange={onTagFilterModeChange}
        />
      </div>
      <StatusFilter value={statusFilter} onChange={onStatusFilterChange} />
    </div>
  );
}

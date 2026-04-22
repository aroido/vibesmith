/**
 * Component Detail feature - Public API
 */

export { copyComponent, getComponent } from './services/api';
export { ComponentDetailPage } from './components/ComponentDetailPage';
export { ComponentDetailDependencies } from './components/ComponentDetailDependencies';
export { ComponentDetailActions } from './components/ComponentDetailActions';
export { ConfirmDeleteModal } from './components/ConfirmDeleteModal';
export { CopyToProjectModal } from './components/CopyToProjectModal';
export { useComponentDetail } from './hooks/useComponentDetail';
export { useComponentUsageTimeline } from './hooks/useComponentUsageTimeline';
export { useComponentMutations } from './hooks/useComponentMutations';
export { useCopyComponent } from './hooks/useCopyComponent';
export type {
  ComponentDetail,
  ComponentUsageTimeline,
  ComponentUsageTimelineEntry,
  ComponentType,
  CopyResponse,
  CopiedItem,
  DependencyInfo,
  DependencyItem,
  UsageTimelineDays,
} from './types';

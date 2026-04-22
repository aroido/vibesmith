/**
 * Skill Conflict Detection feature (Issue #159)
 * 경고 배지 및 Side-by-Side 비교 UI
 */

export { ConflictBadgeWidget } from './components/ConflictBadgeWidget';
export { ConflictListModal } from './components/ConflictListModal';
export { ConflictComparisonModal } from './components/ConflictComparisonModal';
export { useConflicts } from './hooks/useConflicts';
export { useResolveConflict } from './hooks/useResolveConflict';
export { useConflictContent } from './hooks/useConflictContent';
export type { Conflict, ConflictResolveAction } from './types';

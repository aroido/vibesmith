// Public API for dependency-graph feature

// Re-export as DependencyGraphPage so App.tsx lazy import doesn't change
export { DependencyTreePage as DependencyGraphPage } from './components/DependencyTreePage';

// 외부에 노출할 타입만 export
export type {
  GraphData,
  GraphNode,
  GraphEdge,
  DependencyDetail,
  DependencyItem,
  GraphFilters,
  ComponentType,
  DependencyType,
} from './types';

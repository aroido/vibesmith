/**
 * Skill Conflict Detection types (Spec §6.1)
 * Issue #159
 */

export type ComponentType =
  | 'skill'
  | 'agent'
  | 'command'
  | 'hook'
  | 'rule';

export interface Conflict {
  id: string;
  name: string;
  type: ComponentType;
  globalComponentId: string;
  projectComponentId: string;
  projectName: string;
  priority: 'project' | 'global';
  isIntentional: boolean;
}

export type ConflictResolveAction =
  | 'disable_global'
  | 'delete_project'
  | 'rename'
  | 'ignore';

export interface ConflictResolveRequest {
  action: ConflictResolveAction;
  newName?: string;
  target?: 'global' | 'project';
}

export interface ConflictResolveResponse {
  success: boolean;
  conflictId: string;
  updatedComponentIds?: string[];
}

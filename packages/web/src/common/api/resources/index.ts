/**
 * API Resources 공개 API
 * 모든 공통 API 리소스를 중앙에서 export
 */

// Components API
export {
  getComponents,
  getComponent,
  createComponent,
  updateComponent,
  deleteComponent,
  toggleComponent,
  bulkToggleComponents,
  copyComponent,
  getComponentVersions,
  rollbackComponent,
  getAvailableTags,
} from './components';

export type {
  ComponentDetailResponse,
  ComponentListItemResponse,
  TagInfo,
  CreateComponentRequest,
  CreateComponentResponse,
  UpdateComponentRequest,
  UpdateComponentResponse,
  ToggleComponentResponse,
  BulkToggleComponentsResponse,
  CopyComponentResponse,
  VersionHistoryItem,
  RollbackRequest,
  RollbackResponse,
} from './components';

// Projects API
export {
  getProjects,
  deleteProject,
  getProjectComponents,
  getProjectTemplates,
  getProjectTemplate,
  createProjectTemplate,
  updateProjectTemplate,
  deleteProjectTemplate,
  createProjectTemplateFromProject,
  getProjectTemplateRevisions,
  getProjectTemplateRevision,
  restoreProjectTemplateRevision,
  previewProjectPreset,
  applyProjectPreset,
  createProjectWithPreset,
} from './projects';

export type {
  ConflictPolicy,
  ProjectPresetType,
  ProjectResponse,
  ProjectComponentItem,
  ProjectTemplateScope,
  ProjectTemplateComponentBlueprint,
  ProjectTemplateSummaryResponse,
  ProjectTemplateResponse,
  ProjectTemplateListResponse,
  ProjectTemplateCreateRequest,
  ProjectTemplateFromProjectRequest,
  ProjectTemplateRevisionSummaryResponse,
  ProjectTemplateRevisionResponse,
  ProjectTemplateRevisionListResponse,
  PresetPreviewRequest,
  PresetPreviewSummary,
  PresetPreviewItem,
  PresetPreviewResponse,
  PresetApplyRequest,
  PresetApplySummary,
  PresetApplyResponse,
  GetProjectTemplatesOptions,
  CreateProjectWithPresetRequest,
  AppliedPresetResponse,
  CreateProjectWithPresetResponse,
} from './projects';

// Preset/Collection V1 API
export {
  getPresets,
  getPreset,
  createPreset,
  createPresetFromProject,
  updatePreset,
  deletePreset,
  getPresetRevisions,
  getPresetRevision,
  restorePresetRevision,
  getCollections,
  getCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  getCollectionRevisions,
  getCollectionRevision,
  restoreCollectionRevision,
  previewCollectionApply,
  applyCollection,
} from './presetCollections';

export type {
  PresetScope,
  PresetWritableScope,
  PresetComponentType,
  PresetPlatform,
  PinMode,
  CollectionConflictPolicy,
  PresetSummaryResponse,
  PresetResponse,
  PresetListResponse,
  PresetRevisionSummaryResponse,
  PresetRevisionResponse,
  PresetRevisionListResponse,
  CollectionItemInput,
  CollectionItemResolvedResponse,
  CollectionSummaryResponse,
  CollectionResponse,
  CollectionListResponse,
  CollectionRevisionSummaryResponse,
  CollectionRevisionResponse,
  CollectionRevisionListResponse,
  PresetCreateRequest,
  PresetFromProjectRequest,
  CollectionCreateRequest,
  GetPresetsOptions,
  GetCollectionsOptions,
  CollectionPreviewRequest,
  CollectionPreviewSummary,
  CollectionPreviewItem,
  CollectionPreviewResponse,
  CollectionApplyRequest,
  CollectionApplySummary,
  CollectionApplyResponse,
} from './presetCollections';

// Trash API
export {
  getTrashList,
  restoreTrashItem,
  permanentDeleteTrashItem,
  emptyTrash,
} from './trash';

export type { TrashItem, RestoreResponse } from './trash';

// Scan Progress API
export { getScanProgress } from './scanProgress';
export type { ScanProgressResponse, ScanProgressProject } from './scanProgress';

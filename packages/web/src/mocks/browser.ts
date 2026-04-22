/**
 * MSW Browser Worker
 * For development and E2E testing with mock data
 */

import { setupWorker } from 'msw/browser';
import {
  projectsHandlers,
  projectComponentsHandlers,
  componentsHandlers,
  trashHandlers,
  scanHandlers,
  dashboardHandlers,
  conflictsHandlers,
  wizardHandlers,
  templatesHandlers,
  dependenciesHandlers,
  backupHandlers,
  feedbackHandlers,
  licenseHandlers,
  presetCollectionsHandlers,
} from './handlers';

export const worker = setupWorker(
  ...projectsHandlers,
  ...projectComponentsHandlers,
  ...componentsHandlers,
  ...trashHandlers,
  ...scanHandlers,
  ...dashboardHandlers,
  ...conflictsHandlers,
  ...wizardHandlers,
  ...templatesHandlers,
  ...dependenciesHandlers,
  ...backupHandlers,
  ...feedbackHandlers,
  ...licenseHandlers,
  ...presetCollectionsHandlers
);

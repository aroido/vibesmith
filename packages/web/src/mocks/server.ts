/**
 * MSW Server for Node.js (Vitest)
 * Used in setupTests.ts for contract testing
 */

import { setupServer } from 'msw/node';
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

export const server = setupServer(
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
